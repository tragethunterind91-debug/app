"""VIP features backend tests - iteration 3.

Covers all 10 VIP backend capabilities + regression smoke:
- /api/vip/settings GET+PUT, logout-all, devices GET+DELETE, engineer blob
- custom session timeout, IP allowlist, country allowlist, trusted-device cap
- scheduled self-destruct, theme, share link v2, free-tier advance cap
"""
import os
import time
import uuid
import pytest
import requests
from jose import jwt

from pathlib import Path
from dotenv import load_dotenv
load_dotenv(Path(__file__).resolve().parents[2] / 'frontend' / '.env')
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"
ADMIN = {'email': 'admin@example.com', 'password': 'AdminPass123!', 'birthday': '1990-01-01'}
JWT_SECRET = 'dev-mock-session-secret-not-for-prod'


# ---------- helpers ----------
def _login_full(email, password, birthday, extra_headers=None):
    h = {'Content-Type': 'application/json'}
    if extra_headers:
        h.update(extra_headers)
    r = requests.post(f"{API}/auth/login", json={'email': email, 'password': password}, headers=h)
    if r.status_code != 200:
        return r, None
    data = r.json()
    if data.get('stage') == 'complete':
        return r, data['token']
    tok = data['token']
    r2 = requests.post(f"{API}/auth/verify-birthday", json={'birthday': birthday},
                       headers={'Authorization': f'Bearer {tok}', **(extra_headers or {})})
    if r2.status_code != 200:
        return r2, None
    return r2, r2.json()['token']


def _register(birthday='1995-06-15'):
    email = f"test_{uuid.uuid4().hex[:10]}@test.com"
    pw = 'TestPass123!xZ'
    r = requests.post(f"{API}/auth/register", json={'email': email, 'password': pw, 'birthday': birthday})
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    return email, pw, birthday, r.json()['token']


def _bearer(tok):
    return {'Authorization': f'Bearer {tok}'}


# ---------- fixtures ----------
@pytest.fixture(scope='module')
def admin_token():
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    assert tok, 'admin login failed'
    # Ensure admin is VIP
    r = requests.post(f"{API}/vip/purchase", headers=_bearer(tok))
    assert r.status_code == 200
    return tok


# ---------- 1. GET /vip/settings gating ----------
def test_vip_settings_get_admin(admin_token):
    r = requests.get(f"{API}/vip/settings", headers=_bearer(admin_token))
    assert r.status_code == 200
    d = r.json()
    for k in ['allowed_ips', 'allowed_countries', 'session_timeout_min', 'self_destruct_at', 'theme',
              'engineer_blob_bytes', 'engineer_blob_max', 'devices']:
        assert k in d, f"missing {k}"
    assert d['engineer_blob_max'] == 512000


def test_vip_settings_get_non_vip_402():
    _, _, _, tok = _register()
    r = requests.get(f"{API}/vip/settings", headers=_bearer(tok))
    assert r.status_code == 402


# ---------- 2. PUT /vip/settings validation ----------
def test_vip_settings_put_invalid_theme(admin_token):
    r = requests.put(f"{API}/vip/settings", json={'theme': 'rainbow'}, headers=_bearer(admin_token))
    assert r.status_code == 400


def test_vip_settings_put_past_self_destruct(admin_token):
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'default', 'self_destruct_at': '2000-01-01T00:00:00+00:00'},
                     headers=_bearer(admin_token))
    assert r.status_code == 400


def test_vip_settings_put_basic(admin_token):
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'matrix', 'session_timeout_min': 60,
                           'allowed_ips': [], 'allowed_countries': []},
                     headers=_bearer(admin_token))
    assert r.status_code == 200
    r2 = requests.get(f"{API}/vip/settings", headers=_bearer(admin_token))
    assert r2.json()['theme'] == 'matrix'
    assert r2.json()['session_timeout_min'] == 60


# ---------- 3. Custom session timeout reflected in JWT exp ----------
def test_custom_session_timeout_jwt_exp(admin_token):
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'matrix', 'session_timeout_min': 5,
                           'allowed_ips': [], 'allowed_countries': []},
                     headers=_bearer(admin_token))
    assert r.status_code == 200
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    assert tok
    claims = jwt.decode(tok, JWT_SECRET, algorithms=['HS256'])
    exp = claims['exp']
    delta = exp - time.time()
    assert 200 <= delta <= 360, f"exp delta {delta}s not ~5min"
    # Reset timeout to default so subsequent tests aren't impacted
    requests.put(f"{API}/vip/settings",
                 json={'theme': 'matrix', 'session_timeout_min': None,
                       'allowed_ips': [], 'allowed_countries': []},
                 headers=_bearer(tok))


# ---------- 4. logout-all rotates jwt_salt ----------
def test_vip_logout_all_invalidates_token(admin_token):
    old_tok = admin_token
    # Grab a fresh token to use as "old"
    _, old_tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    r = requests.post(f"{API}/vip/logout-all", headers=_bearer(old_tok))
    assert r.status_code == 200
    # Old token should now be rejected on VIP endpoints
    r2 = requests.get(f"{API}/vip/settings", headers=_bearer(old_tok))
    assert r2.status_code == 401
    assert 'signed out' in r2.text.lower() or 'all devices' in r2.text.lower()


# ---------- 5. Devices list + delete ----------
def test_vip_devices_list_and_delete():
    # fresh token after logout-all
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    r = requests.get(f"{API}/vip/devices", headers=_bearer(tok))
    assert r.status_code == 200
    body = r.json()
    assert 'devices' in body and 'cap' in body
    assert body['cap'] == 2
    if body['devices']:
        did = body['devices'][0]['id']
        r2 = requests.delete(f"{API}/vip/devices/{did}", headers=_bearer(tok))
        assert r2.status_code == 200
        r3 = requests.get(f"{API}/vip/devices", headers=_bearer(tok))
        assert all(d['id'] != did for d in r3.json()['devices'])


# ---------- 6. Engineer blob GET/PUT + 413 ----------
def test_engineer_blob_roundtrip():
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    r = requests.put(f"{API}/vip/engineer/blob", json={'data': 'hello'}, headers=_bearer(tok))
    assert r.status_code == 200, r.text
    r2 = requests.get(f"{API}/vip/engineer/blob", headers=_bearer(tok))
    assert r2.status_code == 200
    assert r2.json()['data'] == 'hello'


def test_engineer_blob_too_large():
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    big = 'x' * (512001)
    r = requests.put(f"{API}/vip/engineer/blob", json={'data': big}, headers=_bearer(tok))
    # Pydantic max_length may 422 before reaching 413; both acceptable rejections
    assert r.status_code in (413, 422), r.status_code


# ---------- 7. Share link v2 (VIP) ----------
def test_share_v2_vip_password_and_max_views():
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    # Create a normal (non-advance) item
    r = requests.post(f"{API}/items", json={'name': 'TEST_shareitem', 'value': 'secretval',
                                            'category': 'Secret'}, headers=_bearer(tok))
    assert r.status_code == 200
    item_id = r.json()['id']
    try:
        r = requests.post(f"{API}/items/{item_id}/share",
                          json={'hours': 1, 'max_views': 2, 'password': 'pw1'},
                          headers=_bearer(tok))
        assert r.status_code == 200, r.text
        token = r.json()['token']
        # no password
        r1 = requests.get(f"{API}/share/{token}")
        assert r1.status_code == 401
        # correct password - view 1
        r2 = requests.get(f"{API}/share/{token}", params={'password': 'pw1'})
        assert r2.status_code == 200
        # view 2
        r3 = requests.get(f"{API}/share/{token}", params={'password': 'pw1'})
        assert r3.status_code == 200
        # 3rd - view limit
        r4 = requests.get(f"{API}/share/{token}", params={'password': 'pw1'})
        assert r4.status_code == 410
    finally:
        requests.delete(f"{API}/items/{item_id}", headers=_bearer(tok))


def test_share_v2_non_vip_rejected():
    _, _, _, tok = _register()
    r = requests.post(f"{API}/items", json={'name': 'TEST_sh', 'value': 'x', 'category': 'Secret'},
                      headers=_bearer(tok))
    item_id = r.json()['id']
    r2 = requests.post(f"{API}/items/{item_id}/share",
                       json={'hours': 1, 'max_views': 2, 'password': 'pw1'},
                       headers=_bearer(tok))
    assert r2.status_code == 402


# ---------- 8. Free-tier Advance Mode cap ----------
def test_free_advance_cap_3():
    _, _, _, tok = _register()
    for i in range(3):
        r = requests.post(f"{API}/items", json={
            'name': f'TEST_adv_{i}', 'value': 'v', 'category': 'Secret',
            'advance_mode': True, 'advance_passphrase': 'pass1234'
        }, headers=_bearer(tok))
        assert r.status_code == 200, f"item {i}: {r.status_code} {r.text}"
    r4 = requests.post(f"{API}/items", json={
        'name': 'TEST_adv_4', 'value': 'v', 'category': 'Secret',
        'advance_mode': True, 'advance_passphrase': 'pass1234'
    }, headers=_bearer(tok))
    assert r4.status_code == 402
    assert 'Advance Mode' in r4.text


# ---------- 9. Scheduled self-destruct ----------
def test_scheduled_self_destruct():
    email, pw, bday, tok = _register()
    # Make VIP
    r = requests.post(f"{API}/vip/purchase", headers=_bearer(tok))
    assert r.status_code == 200
    # Create a few items
    for i in range(2):
        requests.post(f"{API}/items", json={'name': f'TEST_sd_{i}', 'value': 'v'},
                      headers=_bearer(tok))
    # Set self-destruct 2s out
    from datetime import datetime, timezone, timedelta
    future = (datetime.now(timezone.utc) + timedelta(seconds=2)).isoformat()
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'default', 'self_destruct_at': future,
                           'allowed_ips': [], 'allowed_countries': []},
                     headers=_bearer(tok))
    assert r.status_code == 200
    time.sleep(3)
    # Attempt a VIP-gated call - should be 410 OR login should be blocked
    r2 = requests.get(f"{API}/vip/settings", headers=_bearer(tok))
    # After wipe, user still exists; vip_settings zeroed. Could be 410 (on this call) or 402 if second call
    # Items should be empty regardless
    items = requests.get(f"{API}/items", headers=_bearer(tok))
    assert items.status_code == 200
    assert items.json() == [], f"items not wiped: {items.json()}"
    # Accept 410 OR 402 (both indicate self-destruct enforcement)
    assert r2.status_code in (410, 402, 401), f"expected destruct, got {r2.status_code}"


# ---------- 10. Trusted device cap - free user ----------
def test_trusted_device_cap_free():
    email, pw, bday, _ = _register()
    # First login UA1
    r1, t1 = _login_full(email, pw, bday, extra_headers={'User-Agent': 'TestBrowserA/1.0'})
    assert t1, f"first login failed: {r1.status_code} {r1.text}"
    # Second login with different UA should be blocked (free cap=1)
    r2 = requests.post(f"{API}/auth/login",
                       json={'email': email, 'password': pw},
                       headers={'Content-Type': 'application/json',
                                'User-Agent': 'TestBrowserB/2.0'})
    assert r2.status_code == 403, f"got {r2.status_code}: {r2.text}"
    assert 'device' in r2.text.lower()


# ---------- 11. IP allowlist ----------
def test_vip_ip_allowlist_blocks_login():
    email, pw, bday, tok = _register()
    r = requests.post(f"{API}/vip/purchase", headers=_bearer(tok))
    assert r.status_code == 200
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'default', 'allowed_ips': ['1.2.3.4'],
                           'allowed_countries': []},
                     headers=_bearer(tok))
    assert r.status_code == 200
    r2 = requests.post(f"{API}/auth/login",
                       json={'email': email, 'password': pw},
                       headers={'x-forwarded-for': '9.9.9.9'})
    assert r2.status_code == 403, f"{r2.status_code}: {r2.text}"
    assert 'IP' in r2.text or 'allowlist' in r2.text.lower()


# ---------- 12. Country allowlist ----------
def test_vip_country_allowlist_blocks_login():
    email, pw, bday, tok = _register()
    r = requests.post(f"{API}/vip/purchase", headers=_bearer(tok))
    assert r.status_code == 200
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'default', 'allowed_countries': ['US'],
                           'allowed_ips': []},
                     headers=_bearer(tok))
    assert r.status_code == 200
    r2 = requests.post(f"http://localhost:8001/api/auth/login",
                       json={'email': email, 'password': pw},
                       headers={'cf-ipcountry': 'IN'})
    # NOTE: public ingress strips 'cf-ipcountry', so hitting backend directly to verify backend logic.
    assert r2.status_code == 403, f"{r2.status_code}: {r2.text}"
    assert 'country' in r2.text.lower()


# ---------- 13. Theme reflected in public_user ----------
def test_theme_in_public_user():
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    r = requests.put(f"{API}/vip/settings",
                     json={'theme': 'neon', 'allowed_ips': [], 'allowed_countries': []},
                     headers=_bearer(tok))
    assert r.status_code == 200
    r2 = requests.get(f"{API}/auth/me", headers=_bearer(tok))
    assert r2.status_code == 200
    assert r2.json().get('theme') == 'neon'
    # reset
    requests.put(f"{API}/vip/settings",
                 json={'theme': 'default', 'allowed_ips': [], 'allowed_countries': []},
                 headers=_bearer(tok))


# ---------- 14. Regression smoke ----------
def test_regression_admin_items_crud_and_stats():
    _, tok = _login_full(ADMIN['email'], ADMIN['password'], ADMIN['birthday'])
    assert tok
    # Create normal item
    r = requests.post(f"{API}/items", json={'name': 'TEST_reg_smoke', 'value': 'v',
                                            'category': 'Secret'}, headers=_bearer(tok))
    assert r.status_code == 200
    item_id = r.json()['id']
    # List
    r2 = requests.get(f"{API}/items", headers=_bearer(tok))
    assert r2.status_code == 200
    assert any(i['id'] == item_id for i in r2.json())
    # Delete
    r3 = requests.delete(f"{API}/items/{item_id}", headers=_bearer(tok))
    assert r3.status_code == 200
    # admin stats
    r4 = requests.get(f"{API}/admin/stats", headers=_bearer(tok))
    assert r4.status_code == 200
