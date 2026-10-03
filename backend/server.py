from fastapi import FastAPI, APIRouter, HTTPException, Header, Request, Response, Cookie, Depends
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from jose import jwt, JWTError
from authlib.integrations.starlette_client import OAuth
from datetime import datetime, timezone, timedelta
from math import ceil
from pathlib import Path
import os, secrets, uuid, hashlib, string, json, random, base64

load_dotenv(Path(__file__).parent / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
router = APIRouter(prefix='/api')
limiter = Limiter(key_func=get_remote_address)
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')

# --- Vault encryption key: fail fast, derive via HKDF-SHA256 ---
_vault_key_raw = os.environ.get('VAULT_KEY', '')
if not _vault_key_raw or len(_vault_key_raw) < 32:
    raise RuntimeError('VAULT_KEY env var is required and must be at least 32 characters. Refusing to start with a weak or auto-generated key (would silently wipe the vault on restart).')
_derived = HKDF(algorithm=hashes.SHA256(), length=32, salt=b'toppass5-vault-v1', info=b'fernet').derive(_vault_key_raw.encode())
fernet = Fernet(base64.urlsafe_b64encode(_derived))
JWT_SECRET = os.environ['SESSION_SECRET']
_WORDS = "able also area army back ball band bank base bath bear beat bell best bird bite blue boat body bold bolt bond bone book boot born boss both bowl calm camp card care cart cast cave cell chat chip chop clay clip coal coat code coil cold come cord core corn cost cozy crab crop cure cute dark dawn dear deck deed deep deny desk dice disk dock dome door dove dusk each ease east edge epic even exam face fact fail fall fame farm fast feel fell felt fern firm fish fist flex flip flow foam fold folk fond font foot ford form fort fuel full fund fuse gale game gate gear glow glue goal gold golf grab gulf gust half hall hand hard haze head heat heel helm help hero high hill hint hold hole home hood hook hope horn hour husk icon idea inch iris iron isle jade jest join joke jolt jump just keen keep kick kind king knob lace lamp land lane last late leaf lean lend life lift like lime line link lion list loom loop lore loss loud love luck make mall mane mark mask mass meat meet mesh milk mine mint mode moon more most much mule muse nail name navy neck need nest news nice node none norm nose note null oath obey once only open oval oven over page pair palm part past path pave peak peel pick pier pine ping pipe plan play plot plow plum pole pond pool port pose prep prey pull pump pure push rack rain rank read real reed reef rely rent rest rice rich ride ring risk road role roll roof rope rose rule rush safe sage sail same sand silk sing sink site size skin slam slim snap snow soil sole song sort soul span spin star stay stem step stir stop suit surf swap tale tall tank tape task tear text tick tide time tilt toad toll tomb tool torn town tree trim true tube tuck tusk unit user vast veil view vine volt walk wall wave west wide wild wind wise wish wolf wood word work wrap yell zero zone zoom".split()
def gen_phrase(): return ' '.join(secrets.SystemRandom().sample(_WORDS, 12))
def hash_phrase(p: str) -> str: return hashlib.sha256(p.strip().lower().encode()).hexdigest()

# --- Layer 3 Crypto Password helpers ---
_L3_CHARS = string.ascii_letters + string.digits + '!@#$%^&*()-_=+[]{}|;:,.<>?'
def gen_l3_passwords(count=20, length=5):
    """Generate `count` random passwords of `length` chars each."""
    return [''.join(secrets.choice(_L3_CHARS) for _ in range(length)) for _ in range(count)]

def hash_birthday(b: str) -> str:
    return hashlib.sha256(b.strip().encode()).hexdigest()

ADVANCE_FAIL_LIMIT = 4
ADVANCE_LOCK_DAYS = 3

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    birthday: str | None = None  # YYYY-MM-DD, required for register
class CustomField(BaseModel):
    key: str = Field(min_length=1, max_length=80)
    value: str = Field(max_length=2000)
class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=10000)
    category: str = 'Secret'
    totp_secret: str | None = None
    url: str | None = None
    advance_mode: bool = False
    advance_passphrase: str | None = None
    tags: list[str] = []
    favorite: bool = False
    notes: str = ''
    custom_fields: list[CustomField] = []
class ItemsImportIn(BaseModel):
    items: list[ItemIn]
class BulkActionIn(BaseModel):
    item_ids: list[str] = Field(min_length=1)
    action: str  # 'delete' | 'move'
    category: str | None = None  # for 'move'
class ShareIn(BaseModel):
    hours: int = Field(default=24, ge=1, le=168)
    max_views: int | None = Field(default=None, ge=1, le=1000)  # VIP: cap total views
    password: str | None = Field(default=None, min_length=1, max_length=200)  # VIP: require passcode
class ShareConsumeIn(BaseModel):
    password: str | None = None
class VipSettingsIn(BaseModel):
    allowed_ips: list[str] = Field(default_factory=list, max_length=20)
    allowed_countries: list[str] = Field(default_factory=list, max_length=50)  # ISO-2 codes
    session_timeout_min: int | None = Field(default=None, ge=1, le=43200)  # 1 min - 30 days
    self_destruct_at: str | None = None  # ISO date; wiped when passed
    theme: str = Field(default='default')  # default|matrix|neon|pastel
class EngineerBlobIn(BaseModel):
    data: str = Field(max_length=512000)  # <= 500 KB raw string
class PhraseIn(BaseModel):
    email: EmailStr
    phrase: str
class PhraseResetIn(BaseModel):
    email: EmailStr
    phrase: str
    new_password: str = Field(min_length=8)
class BirthdayVerify(BaseModel):
    birthday: str
class L3QuizAnswer(BaseModel):
    answers: dict  # {"6": "k8#mQ", "9": "Xp2!z", ...}
class HardcoreSettings(BaseModel):
    enabled: bool = False
    max_login_fail_days: int = Field(default=4, ge=1, le=30)
    max_login_fails: int = Field(default=16, ge=4, le=100)
    max_daily_tries: int = Field(default=4, ge=1, le=20)
    max_layer3_fails: int = Field(default=8, ge=1, le=50)
    password: str = Field(min_length=1, max_length=200)
class LoginHistoryEvent(BaseModel):
    id: str
    ts: str
    device: str
    ip: str = ''

FREE_ADVANCE_LIMIT = 3
FREE_TRUSTED_DEVICES = 1
VIP_TRUSTED_DEVICES = 2
VIP_ENGINEER_MAX_BYTES = 500 * 1024
VALID_THEMES = {'default', 'matrix', 'neon', 'pastel'}

def default_vip_settings():
    return {'allowed_ips': [], 'allowed_countries': [], 'session_timeout_min': None, 'self_destruct_at': None, 'theme': 'default', 'engineer_blob': '', 'devices': [], 'jwt_salt': ''}

def device_id_from_request(request: Request) -> str:
    ua = request.headers.get('user-agent', '')
    return hashlib.sha256(ua.encode()).hexdigest()[:16]

def client_ip(request: Request) -> str:
    forwarded = request.headers.get('x-forwarded-for', '')
    return forwarded.split(',')[0].strip() if forwarded else (request.client.host if request.client else '')

def client_country(request: Request) -> str:
    return (request.headers.get('cf-ipcountry') or request.headers.get('x-vercel-ip-country') or '').upper()

def token_for(user, stage='full'):
    is_admin = user.get('email','') == os.environ.get('ADMIN_EMAIL','__none__')
    # VIP users can customise session timeout; everyone else defaults to 12h.
    timeout_min = 12 * 60
    vs = user.get('vip_settings') or {}
    if is_vip_active(user) and vs.get('session_timeout_min'):
        timeout_min = int(vs['session_timeout_min'])
    exp = datetime.now(timezone.utc) + timedelta(minutes=timeout_min)
    return jwt.encode({'sub': user['id'], 'email': user['email'], 'name': user.get('name',''), 'is_admin': is_admin, 'stage': stage, 'salt': vs.get('jwt_salt',''), 'exp': exp}, JWT_SECRET, algorithm='HS256')
def set_auth_cookie(response: Response, token: str):
    # SameSite=strict + httpOnly + secure. Same-origin SPA; no cross-site cookies.
    response.set_cookie(key='access_token', value=token, httponly=True, secure=True, samesite='strict', max_age=12*60*60, path='/')
def clear_auth_cookie(response: Response):
    response.delete_cookie(key='access_token', path='/')
def _extract_token(authorization: str | None, cookie_token: str | None) -> str | None:
    if authorization and authorization.startswith('Bearer '):
        return authorization[7:]
    return cookie_token or None
def auth_user(authorization, require_full=True, cookie_token: str | None = None):
    token = _extract_token(authorization, cookie_token)
    if not token: raise HTTPException(401, 'Please sign in again')
    try:
        claims = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        if require_full and claims.get('stage', 'full') != 'full':
            raise HTTPException(403, 'Complete all authentication steps first')
        return claims
    except JWTError: raise HTTPException(401, 'Session expired')
def is_vip_active(u):
    vip_until = u.get('vip_until')
    if not vip_until: return False
    try:
        return parse_iso_datetime(vip_until) > datetime.now(timezone.utc)
    except Exception:
        return False
def public_user(u):
    vip_active = is_vip_active(u)
    vs = u.get('vip_settings') or {}
    return {
        'id': u['id'], 'email': u['email'], 'name': u.get('name', u['email'].split('@')[0]),
        'has_birthday': bool(u.get('birthday_hash')),
        'layer3_enabled': u.get('layer3_enabled', False),
        'disclaimer_enabled': u.get('disclaimer_enabled', False),
        'hardcore_enabled': u.get('hardcore_enabled', False),
        'l3_viewed': u.get('l3_viewed', False),
        'advance_global_locked_until': u.get('advance_global_locked_until'),
        'is_vip': vip_active,
        'vip_until': u.get('vip_until') if vip_active else None,
        'theme': vs.get('theme', 'default'),
    }
async def verify_fresh_session(claims: dict) -> dict:
    """Lightweight DB lookup used by sensitive endpoints to honour logout-all + self-destruct."""
    u = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not u:
        raise HTTPException(401, 'User no longer exists')
    vs = u.get('vip_settings') or {}
    # Logout-all: tokens issued before salt rotation are rejected
    if (vs.get('jwt_salt') or '') != (claims.get('salt') or ''):
        raise HTTPException(401, 'Signed out from all devices. Please sign in again.')
    # Scheduled self-destruct: wipe + reject on first access after the chosen date
    sd = vs.get('self_destruct_at')
    if sd:
        try:
            if parse_iso_datetime(sd) <= datetime.now(timezone.utc):
                await db.items.delete_many({'user_id': u['id']})
                await db.shares.delete_many({'user_id': u['id']})
                await db.users.update_one({'id': u['id']}, {'$set': {'vip_settings.self_destruct_at': None, 'vip_settings.self_destructed_at': datetime.now(timezone.utc).isoformat()}})
                raise HTTPException(410, 'Vault self-destructed as scheduled.')
        except HTTPException:
            raise
        except Exception:
            pass
    return u
async def require_vip(authorization):
    """Dependency-style guard for VIP-only endpoints."""
    claims = auth_user(authorization)
    u = await verify_fresh_session(claims)
    if not is_vip_active(u):
        raise HTTPException(402, 'VIP required')
    return claims, u
def safe_item(doc):
    return {'id': doc['id'], 'name': doc['name'], 'category': doc.get('category','Secret'), 'url': doc.get('url',''), 'advance_mode': doc.get('advance_mode', False), 'advance_locked_until': doc.get('advance_locked_until'), 'created_at': doc['created_at'], 'updated_at': doc['updated_at'], 'has_totp': bool(doc.get('totp_enc')), 'tags': doc.get('tags', []), 'favorite': doc.get('favorite', False), 'notes': doc.get('notes', ''), 'custom_fields': doc.get('custom_fields', [])}
async def log_event(user_id: str, action: str, detail: str = ''):
    try: await db.audit.insert_one({'user_id':user_id,'action':action,'detail':detail,'ts':datetime.now(timezone.utc).isoformat()})
    except Exception: pass
async def delete_hardcore_account(user, detail: str):
    user_id = user['id']
    await db.items.delete_many({'user_id': user_id})
    await db.shares.delete_many({'user_id': user_id})
    await db.preferences.delete_many({'user_id': user_id})
    await db.password_history.delete_many({'user_id': user_id})
    await db.login_history.delete_many({'user_id': user_id})
    await db.recovery.delete_many({'user_id': user_id})
    await log_event(user_id, 'HARDCORE_DELETE', detail)
    await db.users.delete_one({'id': user_id})

def parse_iso_datetime(value: str | None):
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except Exception:
        return None

def format_lock_remaining(lock_until: datetime, scope: str = 'item'):
    remaining = max(lock_until - datetime.now(timezone.utc), timedelta())
    total_hours = max(1, int(remaining.total_seconds() // 3600) + (1 if remaining.total_seconds() % 3600 else 0))
    if total_hours >= 24:
        days = ceil(total_hours / 24)
        unit = 'day' if days == 1 else 'days'
        target = 'all Advance Mode items are blocked' if scope == 'global' else 'this item is locked'
        return f'{target}. Try again in {days} {unit}.'
    unit = 'hour' if total_hours == 1 else 'hours'
    target = 'all Advance Mode items are blocked' if scope == 'global' else 'this item is locked'
    return f'{target}. Try again in {total_hours} {unit}.'

async def get_active_advance_global_lock(user_id: str):
    user = await db.users.find_one({'id': user_id}, {'_id': 0, 'advance_global_locked_until': 1})
    lock_until = parse_iso_datetime((user or {}).get('advance_global_locked_until'))
    if lock_until and lock_until > datetime.now(timezone.utc):
        return lock_until
    if user and user.get('advance_global_locked_until'):
        await db.users.update_one({'id': user_id}, {'$unset': {'advance_global_locked_until': ''}})
    return None

async def maybe_activate_advance_global_lock(user_id: str):
    existing_lock = await get_active_advance_global_lock(user_id)
    if existing_lock:
        active_locked_items = await db.items.count_documents({
            'user_id': user_id,
            'advance_mode': True,
            'advance_locked_until': {'$gt': datetime.now(timezone.utc).isoformat()},
        })
        total_items = await db.items.count_documents({'user_id': user_id, 'advance_mode': True})
        return {'lock_until': existing_lock, 'locked_items': active_locked_items, 'total_items': total_items}
    total_items = await db.items.count_documents({'user_id': user_id, 'advance_mode': True})
    if total_items <= 0:
        return None
    locked_items = await db.items.count_documents({
        'user_id': user_id,
        'advance_mode': True,
        'advance_locked_until': {'$gt': datetime.now(timezone.utc).isoformat()},
    })
    threshold = max(1, ceil(total_items / 2))
    if locked_items < threshold:
        return None
    lock_until = datetime.now(timezone.utc) + timedelta(days=ADVANCE_LOCK_DAYS)
    await db.users.update_one({'id': user_id}, {'$set': {'advance_global_locked_until': lock_until.isoformat()}})
    await log_event(user_id, 'ADVANCE_GLOBAL_LOCK', f'{locked_items}/{total_items} Advance Mode items locked')
    return {'lock_until': lock_until, 'locked_items': locked_items, 'total_items': total_items}

async def verify_advance_access(doc, user_id: str, passphrase: str | None):
    if not doc.get('advance_mode'):
        return
    global_lock = await get_active_advance_global_lock(user_id)
    if global_lock:
        raise HTTPException(423, f'Advance Mode safety block active: {format_lock_remaining(global_lock, scope="global")}')
    locked_until = doc.get('advance_locked_until')
    item_lock = parse_iso_datetime(locked_until)
    if item_lock and item_lock > datetime.now(timezone.utc):
        raise HTTPException(423, f'Item locked after too many failed attempts. {format_lock_remaining(item_lock)}')
    if not doc.get('advance_hash') or not pwd.verify(passphrase or '', doc['advance_hash']):
        fails = doc.get('advance_failed_attempts', 0) + 1
        upd = {'advance_failed_attempts': fails}
        if fails >= ADVANCE_FAIL_LIMIT:
            upd['advance_locked_until'] = (datetime.now(timezone.utc) + timedelta(days=ADVANCE_LOCK_DAYS)).isoformat()
            upd['advance_failed_attempts'] = 0
            await db.items.update_one({'id': doc['id'], 'user_id': user_id}, {'$set': upd})
            await log_event(user_id, 'ADVANCE_LOCKED', doc.get('name', doc['id']))
            global_lock_trigger = await maybe_activate_advance_global_lock(user_id)
            if global_lock_trigger:
                raise HTTPException(423, f'Item locked for {ADVANCE_LOCK_DAYS} days after {ADVANCE_FAIL_LIMIT} failed attempts. Safety block activated: {global_lock_trigger["locked_items"]} of {global_lock_trigger["total_items"]} Advance Mode items are now locked, so all Advance Mode items are blocked for {ADVANCE_LOCK_DAYS} days.')
            raise HTTPException(423, f'Item locked for {ADVANCE_LOCK_DAYS} days after {ADVANCE_FAIL_LIMIT} failed attempts.')
        await db.items.update_one({'id': doc['id'], 'user_id': user_id}, {'$set': upd})
        remaining_attempts = ADVANCE_FAIL_LIMIT - fails
        raise HTTPException(401, f'Wrong passphrase. {remaining_attempts} attempt{"s" if remaining_attempts != 1 else ""} remaining before {ADVANCE_LOCK_DAYS}-day lockout.')
    await db.items.update_one({'id': doc['id'], 'user_id': user_id}, {'$set': {'advance_failed_attempts': 0}, '$unset': {'advance_locked_until': ''}})
def describe_device(user_agent: str) -> str:
    ua = (user_agent or '').lower()
    browser = 'Browser'
    if 'edg/' in ua: browser = 'Microsoft Edge'
    elif 'chrome/' in ua and 'chromium' not in ua: browser = 'Chrome'
    elif 'safari/' in ua and 'chrome/' not in ua: browser = 'Safari'
    elif 'firefox/' in ua: browser = 'Firefox'
    os_name = 'Unknown device'
    if 'iphone' in ua: os_name = 'iPhone'
    elif 'ipad' in ua: os_name = 'iPad'
    elif 'android' in ua: os_name = 'Android'
    elif 'windows' in ua: os_name = 'Windows'
    elif 'mac os' in ua or 'macintosh' in ua: os_name = 'macOS'
    elif 'linux' in ua: os_name = 'Linux'
    return f'{browser} on {os_name}'
async def record_login_history(user_id: str, request: Request):
    forwarded = request.headers.get('x-forwarded-for', '')
    ip = forwarded.split(',')[0].strip() if forwarded else (request.client.host if request.client else '')
    await db.login_history.insert_one({'id':str(uuid.uuid4()),'user_id':user_id,'ts':datetime.now(timezone.utc).isoformat(),'device':describe_device(request.headers.get('user-agent','')),'ip':ip})

async def _enforce_vip_login_policy(user, request: Request) -> tuple[bool, str]:
    """VIP: enforce IP allowlist, country lock, scheduled self-destruct, and trusted-device cap.
    Returns (ok, error_message). Free users are allowed through (device cap still applies).
    Also records / promotes the current device fingerprint.
    """
    vs = user.get('vip_settings') or {}
    now = datetime.now(timezone.utc)
    # Scheduled self-destruct — wipe on first login past the chosen date
    sd = vs.get('self_destruct_at')
    if sd:
        try:
            if parse_iso_datetime(sd) <= now:
                await db.items.delete_many({'user_id': user['id']})
                await db.shares.delete_many({'user_id': user['id']})
                await db.users.update_one({'id': user['id']}, {'$set': {'vip_settings.self_destruct_at': None, 'vip_settings.self_destructed_at': now.isoformat()}})
                return False, 'Vault self-destructed as scheduled.'
        except Exception:
            pass
    is_vip = is_vip_active(user)
    ip = client_ip(request)
    country = client_country(request)
    if is_vip:
        allowed_ips = vs.get('allowed_ips') or []
        if allowed_ips and ip and ip not in allowed_ips:
            return False, f'Login blocked: IP {ip} is not on your allowlist.'
        allowed_countries = vs.get('allowed_countries') or []
        if allowed_countries and country and country not in allowed_countries:
            return False, f'Login blocked: country {country} is not on your allowlist.'
    # Device cap — VIP = 2, Free = 1. Devices are keyed by SHA-256 of user-agent.
    cap = VIP_TRUSTED_DEVICES if is_vip else FREE_TRUSTED_DEVICES
    did = device_id_from_request(request)
    devices = (vs.get('devices') or [])
    existing = next((d for d in devices if d['id'] == did), None)
    if existing:
        existing['last_seen'] = now.isoformat()
        await db.users.update_one({'id': user['id'], 'vip_settings.devices.id': did}, {'$set': {'vip_settings.devices.$.last_seen': existing['last_seen']}})
    else:
        if len(devices) >= cap:
            return False, f'Device limit reached ({cap}). Remove a trusted device first.'
        new_device = {'id': did, 'label': describe_device(request.headers.get('user-agent','')), 'ip': ip, 'first_seen': now.isoformat(), 'last_seen': now.isoformat()}
        await db.users.update_one({'id': user['id']}, {'$push': {'vip_settings.devices': new_device}}, upsert=False)
    return True, ''
@router.get('/')
async def root(): return {'message': 'CryptonVault API'}

@router.post('/auth/register')
@limiter.limit('10/hour')
async def register(data: Credentials, request: Request, response: Response):
    if await db.users.find_one({'email': data.email.lower()}): raise HTTPException(409, 'An account already exists')
    if not data.birthday: raise HTTPException(400, 'Birthday is required')
    l3_passwords = gen_l3_passwords(20, 5)
    user = {
        'id': str(uuid.uuid4()), 'email': data.email.lower(), 'password': pwd.hash(data.password),
        'name': data.email.split('@')[0],
        'birthday_hash': hash_birthday(data.birthday),
        'layer3_enabled': False,
        'layer3_passwords_enc': fernet.encrypt(json.dumps(l3_passwords).encode()).decode(),
        'layer3_change_count': 0,
        'layer3_change_month_start': datetime.now(timezone.utc).isoformat(),
        'disclaimer_enabled': False,
        'hardcore_enabled': False,
        'hardcore_settings': {'max_login_fail_days': 4, 'max_login_fails': 16, 'max_daily_tries': 4, 'max_layer3_fails': 8},
        'failed_logins': {'count': 0, 'daily_count': 0, 'last_fail_date': None, 'consecutive_days': 0, 'layer3_fails': 0},
        'created_at': datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user)
    await record_login_history(user['id'], request)
    token = token_for(user)
    set_auth_cookie(response, token)
    return {'token': token, 'user': public_user(user)}

@router.post('/auth/login')
@limiter.limit('20/minute')
async def login(data: Credentials, request: Request, response: Response):
    user = await db.users.find_one({'email': data.email.lower()}, {'_id': 0})
    if not user or not user.get('password'):
        raise HTTPException(401, 'Email or password is incorrect')
    fl = user.get('failed_logins', {})
    lock_until = fl.get('lock_until')
    if lock_until and not user.get('hardcore_enabled'):
        try:
            lock_dt = datetime.fromisoformat(lock_until)
            if lock_dt > datetime.now(timezone.utc):
                mins = max(1, int((lock_dt - datetime.now(timezone.utc)).total_seconds() // 60) + 1)
                raise HTTPException(423, f'Account temporarily locked. Try again in {mins} minute(s).')
            await db.users.update_one({'id': user['id']}, {'$set': {'failed_logins.count': 0, 'failed_logins.daily_count': 0}, '$unset': {'failed_logins.lock_until': ''}})
            user = await db.users.find_one({'id': user['id']}, {'_id': 0})
        except HTTPException:
            raise
        except Exception:
            pass
    # --- Hardcore mode: check if account should be deleted ---
    if user.get('hardcore_enabled'):
        fl = user.get('failed_logins', {})
        hs = user.get('hardcore_settings', {})
        if fl.get('count', 0) >= hs.get('max_login_fails', 16) or fl.get('consecutive_days', 0) >= hs.get('max_login_fail_days', 4):
            await delete_hardcore_account(user, 'Account auto-deleted due to failed login limits')
            raise HTTPException(410, 'Account permanently deleted — too many failed login attempts (Hardcore Mode).')
        # Daily limit check
        today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
        if fl.get('last_fail_date') == today and fl.get('daily_count', 0) >= hs.get('max_daily_tries', 4):
            raise HTTPException(429, f'Daily login limit reached ({hs.get("max_daily_tries", 4)} tries). Try again tomorrow.')
    # --- Verify password ---
    if not pwd.verify(data.password, user['password']):
        await _track_login_fail(user)
        raise HTTPException(401, 'Email or password is incorrect')
    # --- VIP: IP + country allowlists + trusted-device cap ---
    vip_ok, vip_err = await _enforce_vip_login_policy(user, request)
    if not vip_ok:
        await log_event(user['id'], 'LOGIN_BLOCKED', vip_err)
        raise HTTPException(403, vip_err)
    # Password correct - check if birthday verification needed
    has_birthday = bool(user.get('birthday_hash'))
    has_l3 = user.get('layer3_enabled', False)
    if has_birthday:
        # Return stage token - user must verify birthday next
        stage_token = token_for(user, stage='birthday')
        set_auth_cookie(response, stage_token)
        await log_event(user['id'], 'LOGIN_STAGE1', data.email.lower())
        return {'stage': 'birthday', 'token': stage_token, 'user': public_user(user), 'needs_birthday': True, 'needs_layer3': has_l3}
    # No birthday set (legacy user) - grant full access
    await _reset_login_fails(user)
    await db.users.update_one({'id': user['id']}, {'$set': {'last_seen': datetime.now(timezone.utc).isoformat()}})
    await record_login_history(user['id'], request)
    await log_event(user['id'], 'LOGIN', data.email.lower())
    token = token_for(user)
    set_auth_cookie(response, token)
    return {'stage': 'complete', 'token': token, 'user': public_user(user)}

async def _track_login_fail(user):
    fl = user.get('failed_logins', {'count': 0, 'daily_count': 0, 'last_fail_date': None, 'consecutive_days': 0, 'layer3_fails': 0})
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    if fl.get('last_fail_date') == today:
        fl['daily_count'] = fl.get('daily_count', 0) + 1
    else:
        if fl.get('last_fail_date'):
            yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime('%Y-%m-%d')
            if fl['last_fail_date'] == yesterday:
                fl['consecutive_days'] = fl.get('consecutive_days', 0) + 1
            else:
                fl['consecutive_days'] = 1
        else:
            fl['consecutive_days'] = 1
        fl['daily_count'] = 1
        fl['last_fail_date'] = today
    fl['count'] = fl.get('count', 0) + 1
    await db.users.update_one({'id': user['id']}, {'$set': {'failed_logins': fl}})
    if user.get('hardcore_enabled'):
        hs = user.get('hardcore_settings', {})
        if fl['count'] >= hs.get('max_login_fails', 16) or fl['consecutive_days'] >= hs.get('max_login_fail_days', 4):
            await delete_hardcore_account(user, 'Account auto-deleted immediately after failed login limit was reached')
            raise HTTPException(410, 'Account permanently deleted — too many failed login attempts (Hardcore Mode).')
        if fl['daily_count'] >= hs.get('max_daily_tries', 4):
            await log_event(user['id'], 'LOGIN_DAILY_LIMIT', f"daily={fl['daily_count']}")
            raise HTTPException(429, f'Daily login limit reached ({hs.get("max_daily_tries", 4)} tries). Try again tomorrow.')
    elif fl['count'] >= 5:
        fl['lock_until'] = (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat()
        await db.users.update_one({'id': user['id']}, {'$set': {'failed_logins.lock_until': fl['lock_until']}})
    await log_event(user['id'], 'LOGIN_FAIL', f"count={fl['count']}, days={fl['consecutive_days']}")

async def _reset_login_fails(user):
    await db.users.update_one({'id': user['id']}, {'$set': {'failed_logins': {'count': 0, 'daily_count': 0, 'last_fail_date': None, 'consecutive_days': 0, 'layer3_fails': user.get('failed_logins', {}).get('layer3_fails', 0)}}})

@router.post('/auth/verify-birthday')
@limiter.limit('20/minute')
async def verify_birthday(data: BirthdayVerify, request: Request, response: Response, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization, require_full=False)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    if hash_birthday(data.birthday) != user.get('birthday_hash'):
        await _track_login_fail(user)
        raise HTTPException(401, 'Birthday verification failed')
    has_l3 = user.get('layer3_enabled', False)
    if has_l3:
        # Need L3 quiz next
        quiz_indices = sorted(random.sample(range(20), 3))
        stage_token = token_for(user, stage='layer3')
        set_auth_cookie(response, stage_token)
        await db.users.update_one({'id': user['id']}, {'$set': {'pending_quiz': quiz_indices}})
        await log_event(user['id'], 'BIRTHDAY_VERIFIED', user['email'])
        return {'stage': 'layer3', 'token': stage_token, 'quiz_indices': quiz_indices}
    # Birthday verified, no L3 - grant full access
    await _reset_login_fails(user)
    await db.users.update_one({'id': user['id']}, {'$set': {'last_seen': datetime.now(timezone.utc).isoformat()}})
    await record_login_history(user['id'], request)
    await log_event(user['id'], 'LOGIN', user['email'])
    token = token_for(user)
    set_auth_cookie(response, token)
    return {'stage': 'complete', 'token': token, 'user': public_user(user)}

@router.post('/auth/verify-layer3')
@limiter.limit('20/minute')
async def verify_layer3(data: L3QuizAnswer, request: Request, response: Response, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization, require_full=False)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    if not user.get('layer3_passwords_enc'): raise HTTPException(400, 'Layer 3 not set up')
    passwords = json.loads(fernet.decrypt(user['layer3_passwords_enc'].encode()).decode())
    quiz_indices = user.get('pending_quiz', [])
    # Verify each answer
    for idx_str, answer in data.answers.items():
        idx = int(idx_str)
        if idx < 0 or idx >= len(passwords) or passwords[idx] != answer:
            # Track L3 failure
            fl = user.get('failed_logins', {})
            fl['layer3_fails'] = fl.get('layer3_fails', 0) + 1
            await db.users.update_one({'id': user['id']}, {'$set': {'failed_logins': fl}})
            # Hardcore: check L3 fail limit
            if user.get('hardcore_enabled'):
                hs = user.get('hardcore_settings', {})
                if fl['layer3_fails'] >= hs.get('max_layer3_fails', 8):
                    await delete_hardcore_account(user, 'Account deleted: Layer 3 fail limit exceeded')
                    raise HTTPException(410, 'Account permanently deleted — too many Layer 3 failures (Hardcore Mode).')
            await log_event(user['id'], 'L3_FAIL', f"fails={fl['layer3_fails']}")
            raise HTTPException(401, f'Layer 3 verification failed. Wrong answer for pass {idx + 1}.')
    # All correct - grant full access
    await _reset_login_fails(user)
    await db.users.update_one({'id': user['id']}, {'$set': {'last_seen': datetime.now(timezone.utc).isoformat(), 'failed_logins.layer3_fails': 0, 'pending_quiz': []}})
    await record_login_history(user['id'], request)
    await log_event(user['id'], 'LOGIN', user['email'])
    token = token_for(user)
    set_auth_cookie(response, token)
    return {'stage': 'complete', 'token': token, 'user': public_user(user)}

@router.get('/auth/login-history', response_model=list[LoginHistoryEvent])
async def login_history(authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    docs = await db.login_history.find({'user_id': claims['sub']}, {'_id': 0, 'user_id': 0}).sort('ts', -1).to_list(5)
    return docs

@router.post('/auth/toggle-disclaimer')
async def toggle_disclaimer(data: dict, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    enabled = bool(data.get('enabled', False))
    await db.users.update_one({'id': claims['sub']}, {'$set': {'disclaimer_enabled': enabled}})
    return {'ok': True, 'enabled': enabled}

@router.post('/auth/set-birthday')
async def set_birthday(data: BirthdayVerify, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    if user.get('birthday_hash'): raise HTTPException(400, 'Birthday already set. Cannot change.')
    await db.users.update_one({'id': claims['sub']}, {'$set': {'birthday_hash': hash_birthday(data.birthday)}})
    await log_event(claims['sub'], 'BIRTHDAY_SET', 'Legacy user added birthday')
    return {'ok': True}

@router.get('/auth/login-status')
@limiter.limit('30/minute')
async def get_login_status(request: Request, email: str = ''):
    """Public endpoint. Returns a constant, non-identifying shape to prevent user enumeration.
    Per-user hardcore/layer3 details are only exposed to authenticated users via /auth/me."""
    return {'hardcore': False, 'layer3_enabled': False}

@router.get('/auth/layer3-passwords')
async def get_layer3_passwords(authorization: str | None = Header(default=None), for_export: bool = False, password: str | None = None):
    claims = auth_user(authorization)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    if not user.get('layer3_passwords_enc'):
        # Legacy user: generate L3 passwords on first access
        l3_passwords = gen_l3_passwords(20, 5)
        await db.users.update_one({'id': claims['sub']}, {'$set': {
            'layer3_passwords_enc': fernet.encrypt(json.dumps(l3_passwords).encode()).decode(),
            'layer3_enabled': False,
            'layer3_change_count': 0,
            'layer3_change_week_start': datetime.now(timezone.utc).isoformat(),
        }})
        user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    # No one-shot view lock. Account password is required to view when L3 is enabled.
    if user.get('layer3_enabled') and not for_export:
        if not password:
            raise HTTPException(403, 'PASSWORD_REQUIRED')
        if not pwd.verify(password, user['password']):
            raise HTTPException(401, 'Wrong password')
    passwords = json.loads(fernet.decrypt(user['layer3_passwords_enc'].encode()).decode())
    if not for_export:
        await db.users.update_one({'id': claims['sub']}, {'$set': {'l3_viewed': True}})
    return {'passwords': passwords, 'enabled': user.get('layer3_enabled', False)}

@router.post('/auth/toggle-layer3')
async def toggle_layer3(data: dict, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    enable = data.get('enabled', False)
    if enable:
        # Must pass quiz to enable (lock)
        if not user.get('layer3_passwords_enc'): raise HTTPException(400, 'Generate Layer 3 passwords first')
        quiz_answers = data.get('quiz_answers', {})
        quiz_indices = data.get('quiz_indices', [])
        if not quiz_answers or not quiz_indices:
            raise HTTPException(400, 'Must pass quiz to enable Layer 3')
        passwords = json.loads(fernet.decrypt(user['layer3_passwords_enc'].encode()).decode())
        for idx_str, answer in quiz_answers.items():
            idx = int(idx_str)
            if idx < 0 or idx >= len(passwords) or passwords[idx] != answer:
                raise HTTPException(401, f'Wrong answer for pass {idx + 1}. Cannot enable Layer 3.')
    await db.users.update_one({'id': claims['sub']}, {'$set': {'layer3_enabled': enable}})
    await log_event(claims['sub'], 'L3_TOGGLE', f"enabled={enable}")
    return {'ok': True, 'enabled': enable}

@router.post('/auth/regenerate-layer3')
async def regenerate_layer3(data: dict, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    if user.get('layer3_enabled'): raise HTTPException(400, 'Disable Layer 3 before regenerating passwords')
    # Check monthly limit (3 changes per month)
    month_start = user.get('layer3_change_month_start') or user.get('layer3_change_week_start')
    change_count = user.get('layer3_change_count', 0)
    now = datetime.now(timezone.utc)
    if month_start:
        ms = datetime.fromisoformat(month_start).replace(tzinfo=timezone.utc) if '+' not in str(month_start) else datetime.fromisoformat(month_start)
        if (now - ms).days < 30:
            if change_count >= 3:
                raise HTTPException(429, 'You can only change Layer 3 passwords 3 times per month. Try again later.')
        else:
            change_count = 0
            month_start = now.isoformat()
    else:
        month_start = now.isoformat()
    # Verify current password for safety
    if not data.get('password'): raise HTTPException(400, 'Current password required')
    if not pwd.verify(data['password'], user['password']): raise HTTPException(401, 'Wrong password')
    new_passwords = gen_l3_passwords(20, 5)
    await db.users.update_one({'id': claims['sub']}, {'$set': {
        'layer3_passwords_enc': fernet.encrypt(json.dumps(new_passwords).encode()).decode(),
        'layer3_change_count': change_count + 1,
        'layer3_change_month_start': month_start,
    }})
    await log_event(claims['sub'], 'L3_REGEN', f"change #{change_count + 1} this month")
    return {'passwords': new_passwords, 'changes_remaining': 2 - change_count}

@router.get('/auth/hardcore-settings')
async def get_hardcore_settings(authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    return {
        'enabled': user.get('hardcore_enabled', False),
        'settings': user.get('hardcore_settings', {'max_login_fail_days': 4, 'max_login_fails': 16, 'max_daily_tries': 4, 'max_layer3_fails': 8}),
        'failed_logins': user.get('failed_logins', {'count': 0, 'daily_count': 0, 'consecutive_days': 0, 'layer3_fails': 0}),
    }

@router.put('/auth/hardcore-settings')
async def update_hardcore_settings(data: HardcoreSettings, authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    user = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not user: raise HTTPException(404, 'User not found')
    # Require current password to change Hardcore Mode — it can irreversibly delete the vault.
    if not pwd.verify(data.password, user.get('password', '')):
        raise HTTPException(401, 'Wrong account password')
    await db.users.update_one({'id': claims['sub']}, {'$set': {
        'hardcore_enabled': data.enabled,
        'hardcore_settings': {'max_login_fail_days': data.max_login_fail_days, 'max_login_fails': data.max_login_fails, 'max_daily_tries': data.max_daily_tries, 'max_layer3_fails': data.max_layer3_fails}
    }})
    await log_event(claims['sub'], 'HARDCORE_UPDATE', f"enabled={data.enabled}")
    return {'ok': True}

@router.get('/auth/me')
async def me(authorization: str | None = Header(default=None)):
    claims = auth_user(authorization); user = await db.users.find_one({'id': claims['sub']}, {'_id': 0}); return public_user(user)

@router.post('/auth/logout')
async def logout(response: Response):
    clear_auth_cookie(response)
    return {'ok': True}

@router.get('/items')
async def items(authorization: str | None = Header(default=None)):
    user = auth_user(authorization); docs = await db.items.find({'user_id': user['sub']}, {'_id':0}).sort('updated_at', -1).to_list(500)
    return [safe_item(x) for x in docs]

@router.post('/items')
async def create_item(data: ItemIn, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); now = datetime.now(timezone.utc).isoformat()
    if data.advance_mode and not data.advance_passphrase:
        raise HTTPException(400, 'Advance Mode requires a passphrase')
    # Free-tier cap: 3 Advance Mode items. VIP: unlimited.
    if data.advance_mode:
        u = await db.users.find_one({'id': user['sub']}, {'_id': 0})
        if u and not is_vip_active(u):
            existing = await db.items.count_documents({'user_id': user['sub'], 'advance_mode': True})
            if existing >= FREE_ADVANCE_LIMIT:
                raise HTTPException(402, f'Free tier allows up to {FREE_ADVANCE_LIMIT} Advance Mode items. Upgrade to VIP for unlimited.')
    fp = hashlib.sha256(data.value.encode()).hexdigest()
    doc = {'id':str(uuid.uuid4()),'user_id':user['sub'],'name':data.name,'category':data.category,'secret':fernet.encrypt(data.value.encode()).decode(),'value_fingerprint':fp,'value_length':len(data.value),'created_at':now,'updated_at':now,'tags':data.tags,'favorite':data.favorite,'notes':data.notes,'custom_fields':[cf.dict() for cf in data.custom_fields]}
    if data.url: doc['url'] = data.url
    if data.totp_secret: doc['totp_enc']=fernet.encrypt(data.totp_secret.encode()).decode()
    if data.advance_mode:
        doc['advance_mode']=True
        doc['advance_failed_attempts'] = 0
    if data.advance_mode and data.advance_passphrase: doc['advance_hash']=pwd.hash(data.advance_passphrase)
    await db.items.insert_one(doc); await log_event(user['sub'],'CREATE',data.name); return safe_item(doc)

@router.get('/items/{item_id}/value')
async def reveal_item(item_id: str, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); doc = await db.items.find_one({'id':item_id, 'user_id':user['sub']}, {'_id':0})
    if not doc: raise HTTPException(404, 'Item not found')
    if doc.get('advance_mode'): raise HTTPException(403, 'This item is protected by Advance Mode. Use the passphrase-verified endpoint instead.')
    await log_event(user['sub'],'REVEAL',doc['name']); return {'id': item_id, 'value': fernet.decrypt(doc['secret'].encode()).decode()}

@router.put('/items/{item_id}')
async def update_item(item_id: str, data: ItemIn, authorization: str | None = Header(default=None), x_advance_passphrase: str | None = Header(default=None)):
    user = auth_user(authorization); now=datetime.now(timezone.utc).isoformat()
    old_doc = await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not old_doc: raise HTTPException(404,'Item not found')
    if old_doc.get('advance_mode'):
        await verify_advance_access(old_doc, user['sub'], x_advance_passphrase)
    elif data.advance_mode and not data.advance_passphrase:
        raise HTTPException(400, 'Advance Mode requires a passphrase')
    upd={'name':data.name,'category':data.category,'secret':fernet.encrypt(data.value.encode()).decode(),'value_fingerprint':hashlib.sha256(data.value.encode()).hexdigest(),'value_length':len(data.value),'updated_at':now,'url':data.url or '','advance_mode':data.advance_mode,'tags':data.tags,'favorite':data.favorite,'notes':data.notes,'custom_fields':[cf.dict() for cf in data.custom_fields]}
    if data.totp_secret is not None: upd['totp_enc']=fernet.encrypt(data.totp_secret.encode()).decode() if data.totp_secret else None
    if data.advance_mode and data.advance_passphrase:
        upd['advance_hash']=pwd.hash(data.advance_passphrase)
        upd['advance_failed_attempts'] = 0
        upd['advance_locked_until'] = None
    elif data.advance_mode and not old_doc.get('advance_mode'):
        upd['advance_failed_attempts'] = 0
        upd['advance_locked_until'] = None
    elif not data.advance_mode:
        upd['advance_hash']=None
        upd['advance_failed_attempts'] = 0
        upd['advance_locked_until'] = None
    # Track password history if value changed
    old_val = fernet.decrypt(old_doc['secret'].encode()).decode()
    if old_val != data.value:
        await db.password_history.insert_one({'id':str(uuid.uuid4()),'item_id':item_id,'user_id':user['sub'],'old_value_enc':old_doc['secret'],'changed_at':now})
    result=await db.items.update_one({'id':item_id,'user_id':user['sub']},{'$set':upd})
    doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0}); await log_event(user['sub'],'EDIT',data.name); return safe_item(doc)

@router.delete('/items/{item_id}')
async def delete_item(item_id: str, authorization: str | None = Header(default=None), x_advance_passphrase: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    if doc.get('advance_mode'):
        await verify_advance_access(doc, user['sub'], x_advance_passphrase)
    await db.items.delete_one({'id':item_id,'user_id':user['sub']}); await log_event(user['sub'],'DELETE',doc['name']); return {'ok':True}

@router.post('/items/import')
async def import_items(data: ItemsImportIn, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); now=datetime.now(timezone.utc).isoformat(); created=[]
    for item in data.items:
        if item.advance_mode and not item.advance_passphrase:
            # Skip malformed advance-mode entries rather than silently storing them unprotected
            continue
        fp = hashlib.sha256(item.value.encode()).hexdigest()
        doc = {
            'id': str(uuid.uuid4()), 'user_id': user['sub'],
            'name': item.name, 'category': item.category,
            'secret': fernet.encrypt(item.value.encode()).decode(),
            'value_fingerprint': fp, 'value_length': len(item.value),
            'url': item.url or '', 'tags': item.tags, 'favorite': item.favorite,
            'notes': item.notes, 'custom_fields': [cf.dict() for cf in item.custom_fields],
            'created_at': now, 'updated_at': now,
        }
        if item.totp_secret:
            doc['totp_enc'] = fernet.encrypt(item.totp_secret.encode()).decode()
        if item.advance_mode:
            doc['advance_mode'] = True
            doc['advance_hash'] = pwd.hash(item.advance_passphrase)
            doc['advance_failed_attempts'] = 0
        await db.items.insert_one(doc)
        created.append(safe_item(doc))
    return {'count': len(created), 'items': created}

@router.get('/items/{item_id}/totp')
async def get_totp(item_id: str, authorization: str | None = Header(default=None), x_advance_passphrase: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc or not doc.get('totp_enc'): raise HTTPException(404,'No TOTP configured')
    if doc.get('advance_mode'):
        await verify_advance_access(doc, user['sub'], x_advance_passphrase)
    return {'secret':fernet.decrypt(doc['totp_enc'].encode()).decode()}

@router.patch('/items/{item_id}/favorite')
async def toggle_favorite(item_id: str, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    new_val = not doc.get('favorite', False)
    await db.items.update_one({'id':item_id,'user_id':user['sub']},{'$set':{'favorite':new_val}})
    return {'id':item_id,'favorite':new_val}

@router.patch('/items/{item_id}/tags')
async def update_tags(item_id: str, data: dict, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    tags = data.get('tags', [])
    await db.items.update_one({'id':item_id,'user_id':user['sub']},{'$set':{'tags':tags}})
    return {'id':item_id,'tags':tags}

@router.post('/items/bulk-action')
async def bulk_action(data: BulkActionIn, authorization: str | None = Header(default=None)):
    user=auth_user(authorization)
    if data.action == 'delete':
        protected = await db.items.count_documents({'id': {'$in': data.item_ids}, 'user_id': user['sub'], 'advance_mode': True})
        if protected:
            raise HTTPException(403, 'Bulk delete cannot include Advance Mode items. Unlock and delete protected items one at a time.')
        result = await db.items.delete_many({'id':{'$in':data.item_ids},'user_id':user['sub']})
        await log_event(user['sub'],'BULK_DELETE',f"{result.deleted_count} items")
        return {'ok':True,'deleted':result.deleted_count}
    elif data.action == 'move':
        if not data.category: raise HTTPException(400,'Category required for move action')
        result = await db.items.update_many({'id':{'$in':data.item_ids},'user_id':user['sub']},{'$set':{'category':data.category,'updated_at':datetime.now(timezone.utc).isoformat()}})
        await log_event(user['sub'],'BULK_MOVE',f"{result.modified_count} items to {data.category}")
        return {'ok':True,'moved':result.modified_count}
    raise HTTPException(400,'Invalid action')

@router.get('/items/{item_id}/history')
async def get_password_history(item_id: str, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    if doc.get('advance_mode'): raise HTTPException(403,'Password history not available for Advance Mode items')
    history = await db.password_history.find({'item_id':item_id,'user_id':user['sub']},{'_id':0}).sort('changed_at',-1).to_list(10)
    return [{'id':h['id'],'changed_at':h['changed_at'],'value':fernet.decrypt(h['old_value_enc'].encode()).decode()} for h in history]

async def _ensure_fingerprint(doc):
    """One-time backfill for legacy items missing value_fingerprint/value_length."""
    if doc.get('value_fingerprint') and 'value_length' in doc:
        return doc
    try:
        v = fernet.decrypt(doc['secret'].encode()).decode()
        upd = {'value_fingerprint': hashlib.sha256(v.encode()).hexdigest(), 'value_length': len(v)}
        await db.items.update_one({'id': doc['id']}, {'$set': upd})
        doc.update(upd)
    except Exception:
        pass
    return doc

@router.get('/items/duplicates')
async def get_duplicates(authorization: str | None = Header(default=None)):
    """Duplicate detection via pre-computed fingerprint — no mass-decryption."""
    user = auth_user(authorization)
    docs = await db.items.find({'user_id': user['sub']}, {'_id': 0}).to_list(1000)
    fp_map = {}
    for d in docs:
        if d.get('advance_mode'):
            continue
        d = await _ensure_fingerprint(d)
        fp = d.get('value_fingerprint')
        if not fp:
            continue
        fp_map.setdefault(fp, []).append({'id': d['id'], 'name': d['name'], 'category': d.get('category', 'Secret')})
    dupes = [group for group in fp_map.values() if len(group) > 1]
    return {'groups': dupes, 'total_duplicates': sum(len(g) for g in dupes)}

@router.get('/security/report')
async def security_report(authorization: str | None = Header(default=None)):
    """Security report via pre-computed fingerprint and value_length — no mass-decryption."""
    user = auth_user(authorization)
    docs = await db.items.find({'user_id': user['sub']}, {'_id': 0}).to_list(1000)
    if not docs:
        return {'total': 0, 'score': 100, 'weak': [], 'reused': [], 'old': []}
    cutoff = (datetime.now(timezone.utc) - timedelta(days=90)).isoformat()
    weak, fp_map, old = [], {}, []
    total_scanned = 0
    for d in docs:
        if d.get('advance_mode'):
            continue
        d = await _ensure_fingerprint(d)
        total_scanned += 1
        if (d.get('value_length') or 0) < 10:
            weak.append(d['name'])
        fp = d.get('value_fingerprint')
        if fp:
            fp_map.setdefault(fp, []).append(d['name'])
        if d.get('updated_at', '') < cutoff:
            old.append(d['name'])
    reused = [names for names in fp_map.values() if len(names) > 1]
    score = max(0, 100 - len(weak) * 15 - len(reused) * 10 - len(old) * 5)
    return {'total': total_scanned, 'score': score, 'weak': weak, 'reused': reused, 'old': old}

@router.get('/preferences')
async def get_prefs(authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.preferences.find_one({'user_id':user['sub']},{'_id':0})
    return doc or {'categories':['Login','API key','Secret','Secure note','Wi-Fi','Bank']}

@router.put('/preferences')
async def put_prefs(data: dict, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); await db.preferences.update_one({'user_id':user['sub']},{'$set':{**data,'user_id':user['sub']}},upsert=True); return {'ok':True}

@router.post('/items/{item_id}/advance-reveal')
async def advance_reveal(item_id: str, data: dict, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    if not doc.get('advance_mode'): raise HTTPException(400,'Not an Advance Mode item')
    await verify_advance_access(doc, user['sub'], data.get('passphrase', ''))
    await log_event(user['sub'],'ADVANCE_REVEAL',doc['name']); return {'id':item_id,'value':fernet.decrypt(doc['secret'].encode()).decode()}

@router.get('/shares')
async def list_shares(authorization: str | None = Header(default=None)):
    user=auth_user(authorization); now=datetime.now(timezone.utc).isoformat()
    docs=await db.shares.find({'user_id':user['sub'],'expires':{'$gt':now}},{'_id':0}).to_list(100)
    result=[]
    for doc in docs:
        item=await db.items.find_one({'id':doc['item_id']},{'_id':0})
        if item: result.append({'token':doc['token'],'item_name':item['name'],'expires':doc['expires']})
    return result

@router.delete('/shares/{share_token}')
async def revoke_share(share_token: str, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); result=await db.shares.delete_one({'token':share_token,'user_id':user['sub']})
    if not result.deleted_count: raise HTTPException(404,'Share not found or already expired')
    return {'ok':True}

class RecoveryReqIn(BaseModel):
    email: str; app_name: str; description: str; user_id_hint: str = ''

@router.post('/recovery-request')
async def submit_recovery(data: RecoveryReqIn):
    await db.recovery_requests.insert_one({'email':data.email,'user_id_hint':data.user_id_hint,'app_name':data.app_name,'description':data.description,'status':'pending','created_at':datetime.now(timezone.utc).isoformat()})
    return {'ok':True,'message':'Request submitted. The TopPass5 team will review and contact you.'}

VIP_DURATION_DAYS = 75   # 2 months + 15 days
VIP_PRICE_USD = 1.50

@router.get('/vip/status')
async def vip_status(authorization: str | None = Header(default=None)):
    claims = auth_user(authorization)
    u = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not u: raise HTTPException(404, 'User not found')
    active = is_vip_active(u)
    until = u.get('vip_until')
    days_remaining = 0
    if active and until:
        try:
            days_remaining = max(0, (parse_iso_datetime(until) - datetime.now(timezone.utc)).days)
        except Exception:
            days_remaining = 0
    return {
        'is_vip': active,
        'vip_until': until if active else None,
        'days_remaining': days_remaining,
        'price_usd': VIP_PRICE_USD,
        'duration_days': VIP_DURATION_DAYS,
        'purchases': len(u.get('vip_purchases', [])),
    }

@router.post('/vip/purchase')
async def vip_purchase(authorization: str | None = Header(default=None)):
    """DEMO / FAKE payment. Flips VIP flag server-side. Swap for Stripe later."""
    claims = auth_user(authorization)
    u = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    if not u: raise HTTPException(404, 'User not found')
    now = datetime.now(timezone.utc)
    # Extend from current vip_until if still active, otherwise from now
    base = now
    if is_vip_active(u):
        try:
            base = max(base, parse_iso_datetime(u['vip_until']))
        except Exception:
            pass
    new_until = base + timedelta(days=VIP_DURATION_DAYS)
    purchase = {'id': str(uuid.uuid4()), 'ts': now.isoformat(), 'amount_usd': VIP_PRICE_USD, 'provider': 'demo', 'days': VIP_DURATION_DAYS}
    await db.users.update_one({'id': claims['sub']}, {
        '$set': {'vip_until': new_until.isoformat()},
        '$push': {'vip_purchases': purchase},
    })
    await log_event(claims['sub'], 'VIP_PURCHASE', f"demo ${VIP_PRICE_USD} +{VIP_DURATION_DAYS}d")
    u = await db.users.find_one({'id': claims['sub']}, {'_id': 0})
    return {'ok': True, 'user': public_user(u), 'purchase': purchase}


# ============================================================
# VIP capability endpoints — one feature per block.
# ============================================================
@router.get('/vip/settings')
async def get_vip_settings(authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    vs = u.get('vip_settings') or {}
    return {
        'allowed_ips': vs.get('allowed_ips') or [],
        'allowed_countries': vs.get('allowed_countries') or [],
        'session_timeout_min': vs.get('session_timeout_min'),
        'self_destruct_at': vs.get('self_destruct_at'),
        'theme': vs.get('theme') or 'default',
        'engineer_blob_bytes': len((vs.get('engineer_blob') or '').encode()),
        'engineer_blob_max': VIP_ENGINEER_MAX_BYTES,
        'devices': vs.get('devices') or [],
    }

@router.put('/vip/settings')
async def put_vip_settings(data: VipSettingsIn, authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    if data.theme not in VALID_THEMES:
        raise HTTPException(400, f'Invalid theme. Choose from {sorted(VALID_THEMES)}')
    if data.self_destruct_at:
        try:
            if parse_iso_datetime(data.self_destruct_at) <= datetime.now(timezone.utc):
                raise HTTPException(400, 'self_destruct_at must be in the future')
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(400, 'self_destruct_at must be a valid ISO datetime')
    updates = {
        'vip_settings.allowed_ips': list({ip.strip() for ip in data.allowed_ips if ip.strip()}),
        'vip_settings.allowed_countries': list({c.strip().upper() for c in data.allowed_countries if c.strip()}),
        'vip_settings.session_timeout_min': data.session_timeout_min,
        'vip_settings.self_destruct_at': data.self_destruct_at,
        'vip_settings.theme': data.theme,
    }
    await db.users.update_one({'id': claims['sub']}, {'$set': updates})
    await log_event(claims['sub'], 'VIP_SETTINGS', 'updated')
    return {'ok': True}

@router.post('/vip/logout-all')
async def vip_logout_all(authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    new_salt = secrets.token_urlsafe(16)
    await db.users.update_one({'id': claims['sub']}, {'$set': {'vip_settings.jwt_salt': new_salt, 'vip_settings.devices': []}})
    await log_event(claims['sub'], 'VIP_LOGOUT_ALL', 'rotated jwt_salt')
    return {'ok': True, 'message': 'All sessions revoked. Please sign in again.'}

@router.get('/vip/devices')
async def vip_devices(authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    vs = u.get('vip_settings') or {}
    return {'devices': vs.get('devices') or [], 'cap': VIP_TRUSTED_DEVICES}

@router.delete('/vip/devices/{device_id}')
async def vip_remove_device(device_id: str, authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    await db.users.update_one({'id': claims['sub']}, {'$pull': {'vip_settings.devices': {'id': device_id}}})
    await log_event(claims['sub'], 'VIP_DEVICE_REMOVED', device_id)
    return {'ok': True}

@router.get('/vip/engineer/blob')
async def vip_engineer_get(authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    vs = u.get('vip_settings') or {}
    blob = vs.get('engineer_blob') or ''
    return {'data': blob, 'bytes': len(blob.encode()), 'max_bytes': VIP_ENGINEER_MAX_BYTES}

@router.put('/vip/engineer/blob')
async def vip_engineer_put(data: EngineerBlobIn, authorization: str | None = Header(default=None)):
    claims, u = await require_vip(authorization)
    size = len(data.data.encode())
    if size > VIP_ENGINEER_MAX_BYTES:
        raise HTTPException(413, f'Engineer blob exceeds {VIP_ENGINEER_MAX_BYTES} bytes (got {size}).')
    await db.users.update_one({'id': claims['sub']}, {'$set': {'vip_settings.engineer_blob': data.data}})
    await log_event(claims['sub'], 'VIP_ENGINEER_WRITE', f'{size} bytes')
    return {'ok': True, 'bytes': size, 'max_bytes': VIP_ENGINEER_MAX_BYTES}


@router.get('/admin/stats')
async def admin_stats(authorization: str | None = Header(default=None)):
    user=auth_user(authorization)
    if not user.get('is_admin'): raise HTTPException(403,'Owner access only')
    today=datetime.now(timezone.utc).replace(hour=0,minute=0,second=0,microsecond=0).isoformat()
    total_users=await db.users.count_documents({})
    total_items=await db.items.count_documents({})
    adv_items=await db.items.count_documents({'advance_mode':True})
    today_logins=await db.audit.count_documents({'action':'LOGIN','ts':{'$gt':today}})
    week_ago=(datetime.now(timezone.utc)-timedelta(days=7)).isoformat()
    week_logins=await db.audit.count_documents({'action':'LOGIN','ts':{'$gt':week_ago}})
    pending=await db.recovery_requests.count_documents({'status':'pending'})
    requests=await db.recovery_requests.find({'status':'pending'},{'_id':0}).sort('created_at',-1).to_list(50)
    online_today=await db.users.count_documents({'last_seen':{'$gt':today}})
    online_now=await db.users.count_documents({'last_seen':{'$gt':(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()}})
    # VIP metrics (M1–M5)
    now_iso = datetime.now(timezone.utc).isoformat()
    vip_active = await db.users.count_documents({'vip_until': {'$gt': now_iso}})
    vip_purchases_agg = await db.users.aggregate([
        {'$project': {'count': {'$size': {'$ifNull': ['$vip_purchases', []]}}}},
        {'$group': {'_id': None, 'total': {'$sum': '$count'}}},
    ]).to_list(1)
    vip_sold_total = vip_purchases_agg[0]['total'] if vip_purchases_agg else 0
    vip_revenue_usd = round(vip_sold_total * VIP_PRICE_USD, 2)
    hardcore_users = await db.users.count_documents({'hardcore_enabled': True})
    totp_items = await db.items.count_documents({'totp_enc': {'$exists': True}})
    return {
        'total_users':total_users,'total_items':total_items,'adv_items':adv_items,
        'today_logins':today_logins,'week_logins':week_logins,
        'online_today':online_today,'online_now':online_now,
        'pending_recovery':pending,'recovery_requests':requests,
        # VIP metrics
        'vip_active': vip_active,
        'vip_sold_total': vip_sold_total,
        'vip_revenue_usd': vip_revenue_usd,
        'hardcore_users': hardcore_users,
        'totp_items': totp_items,
    }

@router.patch('/admin/recovery/{req_id}')
async def update_recovery(req_id: str, data: dict, authorization: str | None = Header(default=None)):
    user=auth_user(authorization)
    if not user.get('is_admin'): raise HTTPException(403,'Owner access only')
    await db.recovery_requests.update_one({'_id':__import__('bson').ObjectId(req_id)},{'$set':{'status':data.get('status','resolved')}}); return {'ok':True}

@router.get('/audit')
async def get_audit(authorization: str | None = Header(default=None)):
    user=auth_user(authorization); docs=await db.audit.find({'user_id':user['sub']},{'_id':0}).sort('ts',-1).to_list(50); return docs

@router.post('/items/{item_id}/share')
async def share_item(item_id: str, data: ShareIn, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    if doc.get('advance_mode'):
        raise HTTPException(403, 'Advance Mode items cannot be shared')
    # VIP-only enhancements: enforce by looking up VIP state when either enhancement is used
    want_views = data.max_views is not None
    want_password = bool(data.password)
    if want_views or want_password:
        u = await db.users.find_one({'id': user['sub']}, {'_id': 0})
        if not u or not is_vip_active(u):
            raise HTTPException(402, 'View limits and share passwords require VIP.')
    token=secrets.token_urlsafe(20)
    share_doc = {'token':token,'item_id':item_id,'user_id':user['sub'],'expires':(datetime.now(timezone.utc)+timedelta(hours=data.hours)).isoformat(),'views':0}
    if want_views:
        share_doc['max_views'] = int(data.max_views)
    if want_password:
        share_doc['password_hash'] = pwd.hash(data.password)
    await db.shares.insert_one(share_doc)
    await log_event(user['sub'],'SHARE',doc['name'])
    return {'token':token,'hours':data.hours,'max_views':data.max_views,'password_protected':want_password}

@router.get('/share/{share_token}')
async def get_share(share_token: str, password: str | None = None):
    doc=await db.shares.find_one({'token':share_token},{'_id':0})
    if not doc or datetime.fromisoformat(doc['expires'])<datetime.now(timezone.utc): raise HTTPException(404,'Share link expired')
    # VIP: enforce password + view limit if set
    if doc.get('password_hash'):
        if not password or not pwd.verify(password, doc['password_hash']):
            raise HTTPException(401, 'This share link requires a password.')
    if doc.get('max_views') is not None and doc.get('views', 0) >= doc['max_views']:
        raise HTTPException(410, 'Share link view limit reached.')
    item=await db.items.find_one({'id':doc['item_id']},{'_id':0})
    if not item: raise HTTPException(404,'Item not found')
    if item.get('advance_mode'): raise HTTPException(403,'This shared item is now protected by Advance Mode')
    await db.shares.update_one({'token': share_token}, {'$inc': {'views': 1}})
    return {'name':item['name'],'value':fernet.decrypt(item['secret'].encode()).decode(),'expires':doc['expires'],'views':doc.get('views',0)+1,'max_views':doc.get('max_views')}

@router.post('/auth/recovery')
@limiter.limit('5/hour')
async def recovery(data: dict, request: Request):
    email=str(data.get('email','')).lower()
    user=await db.users.find_one({'email':email},{'_id':0})
    if not user: return {'message':'If that email exists, a reset link has been prepared.'}
    code=secrets.token_urlsafe(24)
    await db.recovery.update_one({'user_id':user['id']},{'$set':{'code':code,'user_id':user['id'],'expires':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()}},upsert=True)
    await log_event(user['id'],'PWD_RESET_REQ',email)
    return {'message':'Reset link created.','reset_code':code}

@router.post('/auth/reset-password')
@limiter.limit('10/hour')
async def reset_password(data: dict, request: Request):
    token=data.get('token',''); new_password=data.get('new_password','')
    if len(new_password)<8: raise HTTPException(400,'Password must be at least 8 characters')
    rec=await db.recovery.find_one({'code':token},{'_id':0})
    if not rec or datetime.fromisoformat(rec['expires'])<datetime.now(timezone.utc): raise HTTPException(400,'Reset link has expired or is invalid. Please request a new one.')
    await db.users.update_one({'id':rec['user_id']},{'$set':{'password':pwd.hash(new_password)}})
    await db.recovery.delete_one({'code':token})
    return {'message':'Password reset successfully. Please sign in with your new password.'}

# ============================================================
# EMERGENCY ACCESS — trusted contact can request read-only vault
# access after a user-defined waiting period. User can veto
# during the countdown. Zero external emails; token-based.
# ============================================================
class EmergencyContactIn(BaseModel):
    contact_email: EmailStr
    contact_name: str = Field(min_length=1, max_length=80)
    wait_days: int = Field(default=7, ge=1, le=90)

class EmergencyRequestIn(BaseModel):
    owner_email: EmailStr
    contact_email: EmailStr
    reason: str = Field(max_length=500, default='')

@router.get('/emergency/contact')
async def get_emergency_contact(authorization: str | None = Header(default=None)):
    user = auth_user(authorization)
    u = await db.users.find_one({'id': user['sub']}, {'_id': 0, 'emergency_contact': 1})
    return u.get('emergency_contact') if u else None

@router.post('/emergency/contact')
async def set_emergency_contact(data: EmergencyContactIn, authorization: str | None = Header(default=None)):
    user = auth_user(authorization)
    contact = {
        'contact_email': data.contact_email.lower(),
        'contact_name': data.contact_name,
        'wait_days': data.wait_days,
        'set_at': datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one({'id': user['sub']}, {'$set': {'emergency_contact': contact}})
    await log_event(user['sub'], 'EMERGENCY_CONTACT_SET', data.contact_email)
    return contact

@router.delete('/emergency/contact')
async def delete_emergency_contact(authorization: str | None = Header(default=None)):
    user = auth_user(authorization)
    await db.users.update_one({'id': user['sub']}, {'$unset': {'emergency_contact': ''}})
    await db.emergency_requests.delete_many({'user_id': user['sub']})
    await log_event(user['sub'], 'EMERGENCY_CONTACT_REMOVED', '')
    return {'ok': True}

@router.post('/emergency/request')
@limiter.limit('5/hour')
async def request_emergency_access(data: EmergencyRequestIn, request: Request):
    """Trusted contact submits this to start the countdown."""
    owner_email = data.owner_email.lower()
    contact_email = data.contact_email.lower()
    owner = await db.users.find_one({'email': owner_email}, {'_id': 0})
    if not owner:
        return {'ok': True, 'message': 'If a matching vault exists, the request has been submitted.'}
    ec = owner.get('emergency_contact')
    if not ec or ec.get('contact_email') != contact_email:
        return {'ok': True, 'message': 'If a matching vault exists, the request has been submitted.'}
    existing = await db.emergency_requests.find_one({'user_id': owner['id'], 'status': 'pending'})
    if existing:
        raise HTTPException(409, 'A request is already pending on this vault.')
    wait_days = int(ec.get('wait_days', 7))
    token = secrets.token_urlsafe(24)
    unlocks_at = (datetime.now(timezone.utc) + timedelta(days=wait_days)).isoformat()
    await db.emergency_requests.insert_one({
        'id': str(uuid.uuid4()),
        'user_id': owner['id'],
        'owner_email': owner_email,
        'contact_email': contact_email,
        'reason': data.reason,
        'token': token,
        'status': 'pending',
        'created_at': datetime.now(timezone.utc).isoformat(),
        'unlocks_at': unlocks_at,
    })
    await log_event(owner['id'], 'EMERGENCY_REQUESTED', contact_email)
    return {'ok': True, 'unlocks_at': unlocks_at, 'wait_days': wait_days, 'access_token': token,
            'message': f'Countdown started. Access will be granted in {wait_days} days unless the vault owner cancels.'}

@router.get('/emergency/requests')
async def list_emergency_requests(authorization: str | None = Header(default=None)):
    user = auth_user(authorization)
    docs = await db.emergency_requests.find({'user_id': user['sub']}, {'_id': 0, 'token': 0}).sort('created_at', -1).to_list(50)
    return docs

@router.post('/emergency/cancel/{req_id}')
async def cancel_emergency_request(req_id: str, authorization: str | None = Header(default=None)):
    user = auth_user(authorization)
    result = await db.emergency_requests.update_one(
        {'id': req_id, 'user_id': user['sub'], 'status': 'pending'},
        {'$set': {'status': 'cancelled', 'cancelled_at': datetime.now(timezone.utc).isoformat()}}
    )
    if not result.modified_count:
        raise HTTPException(404, 'Request not found or already resolved.')
    await log_event(user['sub'], 'EMERGENCY_CANCELLED', req_id)
    return {'ok': True}

@router.get('/emergency/export/{token}')
async def emergency_export(token: str):
    """Contact uses the access token AFTER the countdown expires to fetch a read-only export."""
    req = await db.emergency_requests.find_one({'token': token}, {'_id': 0})
    if not req:
        raise HTTPException(404, 'Invalid access token.')
    if req.get('status') != 'pending':
        raise HTTPException(403, f"Request was {req.get('status')}. Access denied.")
    if datetime.fromisoformat(req['unlocks_at']) > datetime.now(timezone.utc):
        remaining = datetime.fromisoformat(req['unlocks_at']) - datetime.now(timezone.utc)
        raise HTTPException(403, f'Countdown still active. {remaining.days} days remaining.')
    items = await db.items.find({'user_id': req['user_id'], 'advance_mode': {'$ne': True}}, {'_id': 0}).to_list(1000)
    export_items = []
    for it in items:
        try:
            export_items.append({
                'name': it['name'], 'category': it.get('category', 'Secret'),
                'value': fernet.decrypt(it['secret'].encode()).decode(),
                'url': it.get('url', ''), 'notes': it.get('notes', ''),
                'tags': it.get('tags', []),
            })
        except Exception:
            pass
    await db.emergency_requests.update_one({'token': token}, {'$set': {'status': 'executed', 'executed_at': datetime.now(timezone.utc).isoformat()}})
    await log_event(req['user_id'], 'EMERGENCY_EXECUTED', req.get('contact_email', ''))
    return {'owner_email': req['owner_email'], 'contact_email': req['contact_email'], 'items': export_items,
            'note': 'Advance Mode items are excluded from emergency access by design.'}



cors_origins=[o.strip() for o in os.environ['CORS_ORIGINS'].split(',') if o.strip()]
if '*' in cors_origins:
    # Safety: wildcard origins are incompatible with credentialed cookies.
    cors_kwargs = {'allow_origins': ['*'], 'allow_credentials': False, 'allow_methods': ['*'], 'allow_headers': ['*']}
else:
    cors_kwargs = {'allow_origins': cors_origins, 'allow_credentials': True, 'allow_methods': ['*'], 'allow_headers': ['*']}
app=FastAPI(title='TopPass5 API')
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.middleware('http')
async def promote_cookie_to_authorization(request: Request, call_next):
    # Lets existing handlers that read Authorization header continue to work
    # when the client uses the httpOnly access_token cookie instead.
    if 'authorization' not in {k.lower() for k in request.headers.keys()}:
        tok = request.cookies.get('access_token')
        if tok:
            headers = list(request.scope.get('headers') or [])
            headers.append((b'authorization', f'Bearer {tok}'.encode()))
            request.scope['headers'] = headers
    return await call_next(request)

app.include_router(router)
app.add_middleware(SessionMiddleware, secret_key=JWT_SECRET, same_site='lax', https_only=True)
app.add_middleware(CORSMiddleware, **cors_kwargs)
@app.on_event('startup')
async def seed_admin():
    admin_email=os.environ.get('ADMIN_EMAIL',''); admin_pass=os.environ.get('ADMIN_PASS',''); admin_birthday=os.environ.get('ADMIN_BIRTHDAY','')
    if admin_email and admin_pass:
        existing = await db.users.find_one({'email': admin_email})
        if not existing:
            l3_passwords = gen_l3_passwords(20, 5)
            await db.users.insert_one({
                'id': str(uuid.uuid4()), 'email': admin_email, 'password': pwd.hash(admin_pass),
                'name': 'TopPass5 Owner', 'google': False,
                'birthday_hash': hash_birthday(admin_birthday) if admin_birthday else None,
                'layer3_enabled': False,
                'layer3_passwords_enc': fernet.encrypt(json.dumps(l3_passwords).encode()).decode(),
                'layer3_change_count': 0, 'layer3_change_month_start': datetime.now(timezone.utc).isoformat(),
                'disclaimer_enabled': False, 'hardcore_enabled': False, 'l3_viewed': False,
                'hardcore_settings': {'max_login_fail_days': 4, 'max_login_fails': 16, 'max_daily_tries': 4, 'max_layer3_fails': 8},
                'failed_logins': {'count': 0, 'daily_count': 0, 'last_fail_date': None, 'consecutive_days': 0, 'layer3_fails': 0},
                'created_at': datetime.now(timezone.utc).isoformat()
            })
        else:
            # Update existing admin: add birthday if missing and set correct fields
            updates = {}
            if not pwd.verify(admin_pass, existing.get('password','')):
                updates['password'] = pwd.hash(admin_pass)
            if admin_birthday and not existing.get('birthday_hash'):
                updates['birthday_hash'] = hash_birthday(admin_birthday)
            if not existing.get('layer3_passwords_enc'):
                l3_passwords = gen_l3_passwords(20, 5)
                updates['layer3_passwords_enc'] = fernet.encrypt(json.dumps(l3_passwords).encode()).decode()
                updates['layer3_enabled'] = False
                updates['layer3_change_count'] = 0
                updates['l3_viewed'] = False
            if updates:
                await db.users.update_one({'email': admin_email}, {'$set': updates})
@app.on_event('shutdown')
async def shutdown(): client.close()