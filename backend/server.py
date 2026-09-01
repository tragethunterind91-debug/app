from fastapi import FastAPI, APIRouter, HTTPException, Header, Request
from fastapi.responses import RedirectResponse
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from passlib.context import CryptContext
from cryptography.fernet import Fernet
from jose import jwt, JWTError
from authlib.integrations.starlette_client import OAuth
from datetime import datetime, timezone, timedelta
from pathlib import Path
import os, secrets, uuid, hashlib

load_dotenv(Path(__file__).parent / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
router = APIRouter(prefix='/api')
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
fernet = Fernet(Fernet.generate_key() if not os.environ.get('VAULT_KEY') else __import__('base64').urlsafe_b64encode(os.environ['VAULT_KEY'].encode()[:32].ljust(32, b'0')))
JWT_SECRET = os.environ['SESSION_SECRET']
_WORDS = "able also area army back ball band bank base bath bear beat bell best bird bite blue boat body bold bolt bond bone book boot born boss both bowl calm camp card care cart cast cave cell chat chip chop clay clip coal coat code coil cold come cord core corn cost cozy crab crop cure cute dark dawn dear deck deed deep deny desk dice disk dock dome door dove dusk each ease east edge epic even exam face fact fail fall fame farm fast feel fell felt fern firm fish fist flex flip flow foam fold folk fond font foot ford form fort fuel full fund fuse gale game gate gear glow glue goal gold golf grab gulf gust half hall hand hard haze head heat heel helm help hero high hill hint hold hole home hood hook hope horn hour husk icon idea inch iris iron isle jade jest join joke jolt jump just keen keep kick kind king knob lace lamp land lane last late leaf lean lend life lift like lime line link lion list loom loop lore loss loud love luck make mall mane mark mask mass meat meet mesh milk mine mint mode moon more most much mule muse nail name navy neck need nest news nice node none norm nose note null oath obey once only open oval oven over page pair palm part past path pave peak peel pick pier pine ping pipe plan play plot plow plum pole pond pool port pose prep prey pull pump pure push rack rain rank read real reed reef rely rent rest rice rich ride ring risk road role roll roof rope rose rule rush safe sage sail same sand silk sing sink site size skin slam slim snap snow soil sole song sort soul span spin star stay stem step stir stop suit surf swap tale tall tank tape task tear text tick tide time tilt toad toll tomb tool torn town tree trim true tube tuck tusk unit user vast veil view vine volt walk wall wave west wide wild wind wise wish wolf wood word work wrap yell zero zone zoom".split()
def gen_phrase(): return ' '.join(secrets.SystemRandom().sample(_WORDS, 12))
def hash_phrase(p: str) -> str: return hashlib.sha256(p.strip().lower().encode()).hexdigest()

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=10000)
    category: str = 'Secret'
    totp_secret: str | None = None
    url: str | None = None
    advance_mode: bool = False
    advance_passphrase: str | None = None
class ItemsImportIn(BaseModel):
    items: list[ItemIn]
class ShareIn(BaseModel):
    hours: int = Field(default=24, ge=1, le=168)
class PhraseIn(BaseModel):
    email: EmailStr
    phrase: str
class PhraseResetIn(BaseModel):
    email: EmailStr
    phrase: str
    new_password: str = Field(min_length=8)

def token_for(user):
    is_admin = user.get('email','') == os.environ.get('ADMIN_EMAIL','__none__')
    return jwt.encode({'sub': user['id'], 'email': user['email'], 'name': user.get('name',''), 'is_admin': is_admin, 'exp': datetime.now(timezone.utc) + timedelta(hours=12)}, JWT_SECRET, algorithm='HS256')
def auth_user(authorization):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401, 'Please sign in again')
    try: return jwt.decode(authorization[7:], JWT_SECRET, algorithms=['HS256'])
    except JWTError: raise HTTPException(401, 'Session expired')
def public_user(u): return {'id': u['id'], 'email': u['email'], 'name': u.get('name', u['email'].split('@')[0])}
def safe_item(doc):
    return {'id': doc['id'], 'name': doc['name'], 'category': doc.get('category','Secret'), 'url': doc.get('url',''), 'advance_mode': doc.get('advance_mode', False), 'advance_locked_until': doc.get('advance_locked_until'), 'created_at': doc['created_at'], 'updated_at': doc['updated_at'], 'has_totp': bool(doc.get('totp_enc'))}
async def log_event(user_id: str, action: str, detail: str = ''):
    try: await db.audit.insert_one({'user_id':user_id,'action':action,'detail':detail,'ts':datetime.now(timezone.utc).isoformat()})
    except Exception: pass
@router.get('/')
async def root(): return {'message': 'CryptonVault API'}

@router.post('/auth/register')
async def register(data: Credentials):
    if await db.users.find_one({'email': data.email.lower()}): raise HTTPException(409, 'An account already exists')
    phrase = gen_phrase()
    user = {'id': str(uuid.uuid4()), 'email': data.email.lower(), 'password': pwd.hash(data.password), 'name': data.email.split('@')[0], 'phrase_hash': hash_phrase(phrase), 'created_at': datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    return {'token': token_for(user), 'user': public_user(user), 'phrase': phrase}

@router.post('/auth/login')
async def login(data: Credentials):
    user = await db.users.find_one({'email': data.email.lower()}, {'_id': 0})
    if not user or not user.get('password') or not pwd.verify(data.password, user['password']): raise HTTPException(401, 'Email or password is incorrect')
    await db.users.update_one({'id':user['id']},{'$set':{'last_seen':datetime.now(timezone.utc).isoformat()}}); await log_event(user['id'],'LOGIN',data.email.lower()); return {'token': token_for(user), 'user': public_user(user)}

@router.post('/auth/phrase-login')
async def phrase_login(data: PhraseIn):
    user=await db.users.find_one({'email':data.email.lower(),'phrase_hash':hash_phrase(data.phrase)},{'_id':0})
    if not user: raise HTTPException(401,'Email or recovery phrase is incorrect')
    await log_event(user['id'],'PHRASE_LOGIN',data.email.lower()); return {'token':token_for(user),'user':public_user(user)}

@router.post('/auth/phrase-reset')
async def phrase_reset(data: PhraseResetIn):
    user=await db.users.find_one({'email':data.email.lower(),'phrase_hash':hash_phrase(data.phrase)},{'_id':0})
    if not user: raise HTTPException(401,'Email or recovery phrase is incorrect')
    await db.users.update_one({'id':user['id']},{'$set':{'password':pwd.hash(data.new_password)}})
    await log_event(user['id'],'PHRASE_RESET',data.email.lower()); return {'message':'Password reset successfully'}

@router.post('/auth/set-phrase')
async def set_phrase(authorization: str | None = Header(default=None)):
    user=auth_user(authorization); phrase=gen_phrase()
    await db.users.update_one({'id':user['sub']},{'$set':{'phrase_hash':hash_phrase(phrase)}})
    await log_event(user['sub'],'SET_PHRASE',user['email']); return {'phrase':phrase}

@router.get('/auth/google')
async def google_login(request: Request):
    oauth = OAuth(); oauth.register(name='google', client_id=os.environ['GOOGLE_CLIENT_ID'], client_secret=os.environ['GOOGLE_CLIENT_SECRET'], server_metadata_url='https://accounts.google.com/.well-known/openid-configuration', client_kwargs={'scope':'openid email profile'})
    request.session['frontend_origin'] = request.query_params.get('frontend_origin', '')
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    return await oauth.google.authorize_redirect(request, str(request.base_url).rstrip('/') + '/api/auth/google/callback')

@router.get('/auth/google/callback')
async def google_callback(request: Request):
    oauth = OAuth(); oauth.register(name='google', client_id=os.environ['GOOGLE_CLIENT_ID'], client_secret=os.environ['GOOGLE_CLIENT_SECRET'], server_metadata_url='https://accounts.google.com/.well-known/openid-configuration', client_kwargs={'scope':'openid email profile'})
    token = await oauth.google.authorize_access_token(request); info = token.get('userinfo') or await oauth.google.userinfo(token=token)
    email = info['email'].lower(); user = await db.users.find_one({'email': email}, {'_id': 0})
    if not user:
        user = {'id': str(uuid.uuid4()), 'email': email, 'name': info.get('name', email.split('@')[0]), 'google': True, 'created_at': datetime.now(timezone.utc).isoformat()}; await db.users.insert_one(user)
    # REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    destination = request.session.pop('frontend_origin', '')
    return RedirectResponse(url=f"{destination}/?token={token_for(user)}" if destination else '/')

@router.get('/auth/me')
async def me(authorization: str | None = Header(default=None)):
    claims = auth_user(authorization); user = await db.users.find_one({'id': claims['sub']}, {'_id': 0}); return public_user(user)

@router.get('/items')
async def items(authorization: str | None = Header(default=None)):
    user = auth_user(authorization); docs = await db.items.find({'user_id': user['sub']}, {'_id':0}).sort('updated_at', -1).to_list(500)
    return [safe_item(x) for x in docs]

@router.post('/items')
async def create_item(data: ItemIn, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); now = datetime.now(timezone.utc).isoformat()
    doc = {'id':str(uuid.uuid4()),'user_id':user['sub'],'name':data.name,'category':data.category,'secret':fernet.encrypt(data.value.encode()).decode(),'created_at':now,'updated_at':now}
    if data.url: doc['url'] = data.url
    if data.totp_secret: doc['totp_enc']=fernet.encrypt(data.totp_secret.encode()).decode()
    if data.advance_mode: doc['advance_mode']=True
    if data.advance_mode and data.advance_passphrase: doc['advance_hash']=pwd.hash(data.advance_passphrase)
    await db.items.insert_one(doc); await log_event(user['sub'],'CREATE',data.name); return safe_item(doc)

@router.get('/items/{item_id}/value')
async def reveal_item(item_id: str, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); doc = await db.items.find_one({'id':item_id, 'user_id':user['sub']}, {'_id':0})
    if not doc: raise HTTPException(404, 'Item not found')
    await log_event(user['sub'],'REVEAL',doc['name']); return {'id': item_id, 'value': fernet.decrypt(doc['secret'].encode()).decode()}

@router.put('/items/{item_id}')
async def update_item(item_id: str, data: ItemIn, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); now=datetime.now(timezone.utc).isoformat()
    upd={'name':data.name,'category':data.category,'secret':fernet.encrypt(data.value.encode()).decode(),'updated_at':now,'url':data.url or '','advance_mode':data.advance_mode}
    if data.totp_secret is not None: upd['totp_enc']=fernet.encrypt(data.totp_secret.encode()).decode() if data.totp_secret else None
    if data.advance_mode and data.advance_passphrase: upd['advance_hash']=pwd.hash(data.advance_passphrase)
    elif not data.advance_mode: upd['advance_hash']=None
    result=await db.items.update_one({'id':item_id,'user_id':user['sub']},{'$set':upd})
    if not result.matched_count: raise HTTPException(404,'Item not found')
    doc=await db.items.find_one({'id':item_id},{'_id':0}); await log_event(user['sub'],'EDIT',data.name); return safe_item(doc)

@router.delete('/items/{item_id}')
async def delete_item(item_id: str, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    await db.items.delete_one({'id':item_id,'user_id':user['sub']}); await log_event(user['sub'],'DELETE',doc['name']); return {'ok':True}

@router.post('/items/import')
async def import_items(data: ItemsImportIn, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); now=datetime.now(timezone.utc).isoformat(); created=[]
    for item in data.items:
        doc={'id':str(uuid.uuid4()),'user_id':user['sub'],'name':item.name,'category':item.category,'secret':fernet.encrypt(item.value.encode()).decode(),'created_at':now,'updated_at':now}
        await db.items.insert_one(doc); created.append(safe_item(doc))
    return {'count':len(created),'items':created}

@router.get('/items/{item_id}/totp')
async def get_totp(item_id: str, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc or not doc.get('totp_enc'): raise HTTPException(404,'No TOTP configured')
    return {'secret':fernet.decrypt(doc['totp_enc'].encode()).decode()}

@router.get('/security/report')
async def security_report(authorization: str | None = Header(default=None)):
    user=auth_user(authorization); docs=await db.items.find({'user_id':user['sub']},{'_id':0}).to_list(1000)
    if not docs: return {'total':0,'score':100,'weak':[],'reused':[],'old':[]}
    vals=[fernet.decrypt(d['secret'].encode()).decode() for d in docs]
    cutoff=(datetime.now(timezone.utc)-timedelta(days=90)).isoformat()
    weak=[d['name'] for d,v in zip(docs,vals) if len(v)<10]
    seen={}
    for d,v in zip(docs,vals): seen.setdefault(v,[]).append(d['name'])
    reused=[names for names in seen.values() if len(names)>1]
    old=[d['name'] for d in docs if d.get('updated_at','')< cutoff]
    score=max(0,100-len(weak)*15-len(reused)*10-len(old)*5)
    return {'total':len(docs),'score':score,'weak':weak,'reused':reused,'old':old}

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
    locked_until=doc.get('advance_locked_until')
    if locked_until and datetime.fromisoformat(locked_until)>datetime.now(timezone.utc):
        remaining=datetime.fromisoformat(locked_until)-datetime.now(timezone.utc)
        days=remaining.days+1
        raise HTTPException(423,f'Item locked after too many failed attempts. Try again in {days} day{"s" if days!=1 else ""}.')
    if not doc.get('advance_hash') or not pwd.verify(data.get('passphrase',''),doc['advance_hash']):
        fails=doc.get('advance_failed_attempts',0)+1
        upd={'advance_failed_attempts':fails}
        if fails>=4:
            upd['advance_locked_until']=(datetime.now(timezone.utc)+timedelta(days=3)).isoformat()
            upd['advance_failed_attempts']=0
            await db.items.update_one({'id':item_id},{'$set':upd})
            await log_event(user['sub'],'ADVANCE_LOCKED',doc['name'])
            raise HTTPException(423,'Item locked for 3 days after 4 failed attempts.')
        await db.items.update_one({'id':item_id},{'$set':upd})
        remaining_attempts=4-fails
        raise HTTPException(401,f'Wrong passphrase. {remaining_attempts} attempt{"s" if remaining_attempts!=1 else ""} remaining before 3-day lockout.')
    await db.items.update_one({'id':item_id},{'$set':{'advance_failed_attempts':0}})
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
    return {'total_users':total_users,'total_items':total_items,'adv_items':adv_items,'today_logins':today_logins,'week_logins':week_logins,'online_today':online_today,'online_now':online_now,'pending_recovery':pending,'recovery_requests':requests}

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
    token=secrets.token_urlsafe(20); await db.shares.insert_one({'token':token,'item_id':item_id,'user_id':user['sub'],'expires':(datetime.now(timezone.utc)+timedelta(hours=data.hours)).isoformat()}); await log_event(user['sub'],'SHARE',doc['name']); return {'token':token,'hours':data.hours}

@router.get('/share/{share_token}')
async def get_share(share_token: str):
    doc=await db.shares.find_one({'token':share_token},{'_id':0})
    if not doc or datetime.fromisoformat(doc['expires'])<datetime.now(timezone.utc): raise HTTPException(404,'Share link expired')
    item=await db.items.find_one({'id':doc['item_id']},{'_id':0})
    if not item: raise HTTPException(404,'Item not found')
    return {'name':item['name'],'value':fernet.decrypt(item['secret'].encode()).decode(),'expires':doc['expires']}

@router.post('/auth/recovery')
async def recovery(data: dict):
    email=str(data.get('email','')).lower()
    user=await db.users.find_one({'email':email},{'_id':0})
    if not user: return {'message':'If that email exists, a reset link has been prepared.'}
    code=secrets.token_urlsafe(24)
    await db.recovery.update_one({'user_id':user['id']},{'$set':{'code':code,'user_id':user['id'],'expires':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()}},upsert=True)
    await log_event(user['id'],'PWD_RESET_REQ',email)
    return {'message':'Reset link created.','reset_code':code}

@router.post('/auth/reset-password')
async def reset_password(data: dict):
    token=data.get('token',''); new_password=data.get('new_password','')
    if len(new_password)<8: raise HTTPException(400,'Password must be at least 8 characters')
    rec=await db.recovery.find_one({'code':token},{'_id':0})
    if not rec or datetime.fromisoformat(rec['expires'])<datetime.now(timezone.utc): raise HTTPException(400,'Reset link has expired or is invalid. Please request a new one.')
    await db.users.update_one({'id':rec['user_id']},{'$set':{'password':pwd.hash(new_password)}})
    await db.recovery.delete_one({'code':token})
    return {'message':'Password reset successfully. Please sign in with your new password.'}

app=FastAPI(title='TopPass5 API'); app.include_router(router); app.add_middleware(SessionMiddleware, secret_key=JWT_SECRET, same_site='lax', https_only=True); app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS','*').split(','), allow_methods=['*'], allow_headers=['*'])
@app.on_event('startup')
async def seed_admin():
    admin_email=os.environ.get('ADMIN_EMAIL',''); admin_pass=os.environ.get('ADMIN_PASS','')
    if admin_email and admin_pass and not await db.users.find_one({'email':admin_email}):
        await db.users.insert_one({'id':str(uuid.uuid4()),'email':admin_email,'password':pwd.hash(admin_pass),'name':'TopPass5 Owner','google':False,'created_at':datetime.now(timezone.utc).isoformat()})
@app.on_event('shutdown')
async def shutdown(): client.close()