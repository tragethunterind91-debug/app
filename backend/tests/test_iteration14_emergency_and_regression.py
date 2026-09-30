"""Iteration 14 backend tests: Emergency Access endpoints + regression on core auth/items."""
import os
import time
import uuid
import pytest
import requests

# Load REACT_APP_BACKEND_URL from frontend .env if not present in environment
if 'REACT_APP_BACKEND_URL' not in os.environ:
    with open('/app/frontend/.env') as _f:
        for _line in _f:
            if _line.startswith('REACT_APP_BACKEND_URL='):
                os.environ['REACT_APP_BACKEND_URL'] = _line.split('=', 1)[1].strip()
                break
BASE_URL = os.environ['REACT_APP_BACKEND_URL'].rstrip('/')
API = f"{BASE_URL}/api"

ADMIN_EMAIL = 'admin@toppass5.com'
ADMIN_PASS = 'TopPass5Owner!2024'
ADMIN_BDAY = '1990-01-01'


# --- Auth helpers ---
def login_full(email, password, birthday):
    s = requests.Session()
    s.headers.update({'Content-Type': 'application/json'})
    r = s.post(f"{API}/auth/login", json={'email': email, 'password': password})
    assert r.status_code == 200, f"login failed: {r.status_code} {r.text}"
    data = r.json()
    if data.get('stage') == 'complete':
        s.headers['Authorization'] = f"Bearer {data['token']}"
        return s
    stage_token = data['token']
    s.headers['Authorization'] = f"Bearer {stage_token}"
    r2 = s.post(f"{API}/auth/verify-birthday", json={'birthday': birthday})
    assert r2.status_code == 200, f"verify-birthday failed: {r2.status_code} {r2.text}"
    d2 = r2.json()
    if d2.get('stage') == 'complete':
        s.headers['Authorization'] = f"Bearer {d2['token']}"
        return s
    # Layer3 quiz — skip these tests if L3 enabled
    pytest.skip("Layer3 quiz required — skipping")


@pytest.fixture(scope='module')
def admin_client():
    return login_full(ADMIN_EMAIL, ADMIN_PASS, ADMIN_BDAY)


@pytest.fixture(scope='module')
def new_user():
    """Register a fresh user for isolated emergency tests."""
    email = f"TEST_emer_{uuid.uuid4().hex[:8]}@example.com"
    password = 'TestPass!234'
    birthday = '1995-05-05'
    r = requests.post(f"{API}/auth/register", json={'email': email, 'password': password, 'birthday': birthday})
    assert r.status_code in (200, 201), f"register failed: {r.status_code} {r.text}"
    session = login_full(email, password, birthday)
    return {'email': email, 'password': password, 'birthday': birthday, 'session': session}


# --- Regression: core auth/items ---
class TestRegression:
    def test_login_admin(self, admin_client):
        r = admin_client.get(f"{API}/items")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_item(self, admin_client):
        payload = {'name': 'TEST_reg_item', 'category': 'Password', 'value': 'secret123'}
        r = admin_client.post(f"{API}/items", json=payload)
        assert r.status_code in (200, 201), r.text
        data = r.json()
        assert data['name'] == 'TEST_reg_item'
        assert 'id' in data
        # Cleanup
        admin_client.delete(f"{API}/items/{data['id']}")

    def test_items_import(self, admin_client):
        payload = {'items': [{'name': 'TEST_imp_1', 'category': 'Password', 'value': 'v1'},
                             {'name': 'TEST_imp_2', 'category': 'Password', 'value': 'v2'}]}
        r = admin_client.post(f"{API}/items/import", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data['count'] == 2
        for it in data['items']:
            admin_client.delete(f"{API}/items/{it['id']}")

    def test_layer3_passwords_export(self, admin_client):
        # for_export=true bypasses one-view guard
        r = admin_client.get(f"{API}/auth/layer3-passwords?for_export=true&password={ADMIN_PASS}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'passwords' in data
        assert isinstance(data['passwords'], list)
        assert len(data['passwords']) == 20


# --- Emergency Access ---
class TestEmergencyAccess:
    def test_get_contact_initially_none(self, new_user):
        s = new_user['session']
        r = s.get(f"{API}/emergency/contact")
        assert r.status_code == 200
        # Either None or missing contact
        assert r.json() in (None, {}) or r.json() is None

    def test_set_contact(self, new_user):
        s = new_user['session']
        payload = {'contact_email': 'buddy@example.com', 'contact_name': 'Buddy', 'wait_days': 7}
        r = s.post(f"{API}/emergency/contact", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data['contact_email'] == 'buddy@example.com'
        assert data['wait_days'] == 7
        # Verify GET returns it
        r2 = s.get(f"{API}/emergency/contact")
        assert r2.status_code == 200
        assert r2.json()['contact_email'] == 'buddy@example.com'

    def test_public_request_creates_pending(self, new_user):
        # No auth required — public endpoint
        payload = {'owner_email': new_user['email'], 'contact_email': 'buddy@example.com', 'reason': 'test'}
        r = requests.post(f"{API}/emergency/request", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert 'access_token' in data
        assert 'unlocks_at' in data
        new_user['access_token'] = data['access_token']

    def test_public_request_wrong_contact_email(self, new_user):
        payload = {'owner_email': new_user['email'], 'contact_email': 'wrong@example.com'}
        r = requests.post(f"{API}/emergency/request", json=payload)
        # Should silently succeed with generic message (privacy)
        assert r.status_code == 200
        assert 'access_token' not in r.json()

    def test_owner_lists_pending_request(self, new_user):
        s = new_user['session']
        r = s.get(f"{API}/emergency/requests")
        assert r.status_code == 200
        reqs = r.json()
        assert isinstance(reqs, list)
        assert len(reqs) >= 1
        assert reqs[0]['status'] == 'pending'
        new_user['req_id'] = reqs[0]['id']

    def test_export_during_countdown_forbidden(self, new_user):
        token = new_user['access_token']
        r = requests.get(f"{API}/emergency/export/{token}")
        assert r.status_code == 403, r.text
        assert 'countdown' in r.text.lower() or 'remaining' in r.text.lower()

    def test_duplicate_pending_conflict(self, new_user):
        payload = {'owner_email': new_user['email'], 'contact_email': 'buddy@example.com'}
        r = requests.post(f"{API}/emergency/request", json=payload)
        assert r.status_code == 409

    def test_owner_cancels_request(self, new_user):
        s = new_user['session']
        r = s.post(f"{API}/emergency/cancel/{new_user['req_id']}")
        assert r.status_code == 200
        assert r.json()['ok'] is True

    def test_export_cancelled_forbidden(self, new_user):
        token = new_user['access_token']
        r = requests.get(f"{API}/emergency/export/{token}")
        assert r.status_code == 403
        assert 'cancelled' in r.text.lower()

    def test_export_invalid_token(self):
        r = requests.get(f"{API}/emergency/export/definitely_not_a_real_token_xxx")
        assert r.status_code == 404

    def test_delete_contact(self, new_user):
        s = new_user['session']
        r = s.delete(f"{API}/emergency/contact")
        assert r.status_code == 200
        # Verify gone
        r2 = s.get(f"{API}/emergency/contact")
        assert r2.status_code == 200
        assert r2.json() in (None, {}) or r2.json() is None
