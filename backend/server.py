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
import os, secrets, uuid

load_dotenv(Path(__file__).parent / '.env')
client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
router = APIRouter(prefix='/api')
pwd = CryptContext(schemes=['bcrypt'], deprecated='auto')
fernet = Fernet(Fernet.generate_key() if not os.environ.get('VAULT_KEY') else __import__('base64').urlsafe_b64encode(os.environ['VAULT_KEY'].encode()[:32].ljust(32, b'0')))
JWT_SECRET = os.environ['SESSION_SECRET']

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
class ItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    value: str = Field(min_length=1, max_length=10000)
    category: str = 'Secret'
class ShareIn(BaseModel):
    expires_hours: int = Field(default=24, ge=1, le=168)
    access_password: str | None = None

def token_for(user):
    return jwt.encode({'sub': user['id'], 'email': user['email'], 'exp': datetime.now(timezone.utc) + timedelta(hours=12)}, JWT_SECRET, algorithm='HS256')
def auth_user(authorization):
    if not authorization or not authorization.startswith('Bearer '): raise HTTPException(401, 'Please sign in again')
    try: return jwt.decode(authorization[7:], JWT_SECRET, algorithms=['HS256'])
    except JWTError: raise HTTPException(401, 'Session expired')
def public_user(u): return {'id': u['id'], 'email': u['email'], 'name': u.get('name', u['email'].split('@')[0])}
def safe_item(doc):
    return {'id': doc['id'], 'name': doc['name'], 'category': doc.get('category','Secret'), 'created_at': doc['created_at'], 'updated_at': doc['updated_at']}

@router.get('/')
async def root(): return {'message': 'CryptonVault API'}

@router.post('/auth/register')
async def register(data: Credentials):
    if await db.users.find_one({'email': data.email.lower()}): raise HTTPException(409, 'An account already exists')
    user = {'id': str(uuid.uuid4()), 'email': data.email.lower(), 'password': pwd.hash(data.password), 'name': data.email.split('@')[0], 'created_at': datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(user)
    return {'token': token_for(user), 'user': public_user(user)}

@router.post('/auth/login')
async def login(data: Credentials):
    user = await db.users.find_one({'email': data.email.lower()}, {'_id': 0})
    if not user or not user.get('password') or not pwd.verify(data.password, user['password']): raise HTTPException(401, 'Email or password is incorrect')
    return {'token': token_for(user), 'user': public_user(user)}

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
    user = auth_user(authorization); now = datetime.now(timezone.utc).isoformat(); doc = {'id':str(uuid.uuid4()), 'user_id':user['sub'], 'name':data.name, 'category':data.category, 'secret':fernet.encrypt(data.value.encode()).decode(), 'created_at':now, 'updated_at':now}; await db.items.insert_one(doc); return safe_item(doc)

@router.get('/items/{item_id}/value')
async def reveal_item(item_id: str, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); doc = await db.items.find_one({'id':item_id, 'user_id':user['sub']}, {'_id':0})
    if not doc: raise HTTPException(404, 'Item not found')
    return {'id': item_id, 'value': fernet.decrypt(doc['secret'].encode()).decode()}

@router.put('/items/{item_id}')
async def update_item(item_id: str, data: ItemIn, authorization: str | None = Header(default=None)):
    user = auth_user(authorization); now=datetime.now(timezone.utc).isoformat(); result=await db.items.update_one({'id':item_id,'user_id':user['sub']},{'$set':{'name':data.name,'category':data.category,'secret':fernet.encrypt(data.value.encode()).decode(),'updated_at':now}})
    if not result.matched_count: raise HTTPException(404,'Item not found')
    doc=await db.items.find_one({'id':item_id},{'_id':0}); return safe_item(doc)

@router.delete('/items/{item_id}')
async def delete_item(item_id: str, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); result=await db.items.delete_one({'id':item_id,'user_id':user['sub']})
    if not result.deleted_count: raise HTTPException(404,'Item not found')
    return {'ok':True}

@router.post('/items/{item_id}/share')
async def share_item(item_id: str, data: ShareIn, authorization: str | None = Header(default=None)):
    user=auth_user(authorization); doc=await db.items.find_one({'id':item_id,'user_id':user['sub']},{'_id':0})
    if not doc: raise HTTPException(404,'Item not found')
    share=secrets.token_urlsafe(24); await db.shares.insert_one({'token':share,'item_id':item_id,'expires':(datetime.now(timezone.utc)+timedelta(hours=data.expires_hours)).isoformat(),'password':pwd.hash(data.access_password) if data.access_password else None}); return {'token':share,'expires':data.expires_hours}

@router.get('/shares/{share_token}')
async def get_share(share_token: str):
    doc=await db.shares.find_one({'token':share_token},{'_id':0})
    if not doc or datetime.fromisoformat(doc['expires']) < datetime.now(timezone.utc): raise HTTPException(404,'Share expired')
    item=await db.items.find_one({'id':doc['item_id']},{'_id':0}); return {'name':item['name'],'value':fernet.decrypt(item['secret'].encode()).decode()} if not doc.get('password') else {'name':item['name'],'locked':True}

@router.post('/auth/recovery')
async def recovery(data: dict):
    user=await db.users.find_one({'email':str(data.get('email','')).lower()},{'_id':0})
    if not user: return {'message':'If that email exists, recovery instructions are ready.'}
    code=secrets.token_urlsafe(18); await db.recovery.insert_one({'code':code,'user_id':user['id'],'expires':(datetime.now(timezone.utc)+timedelta(hours=1)).isoformat()}); return {'message':'Recovery code created for this demo.', 'recovery_code':code}

app=FastAPI(title='CryptonVault API'); app.include_router(router); app.add_middleware(SessionMiddleware, secret_key=JWT_SECRET, same_site='lax', https_only=True); app.add_middleware(CORSMiddleware, allow_credentials=True, allow_origins=os.environ.get('CORS_ORIGINS','*').split(','), allow_methods=['*'], allow_headers=['*'])
@app.on_event('shutdown')
async def shutdown(): client.close()