"""Focused retest for iteration 2:
- Fix #1: GET /api/admin/stats returns 200 for admin and 401/403 for non-admin.
- Smoke: admin staged login (login -> verify-birthday).
- Smoke: items CRUD regression (create + list).
"""
import os
import uuid
import pytest
import requests


def _load_frontend_env():
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.strip().startswith("REACT_APP_BACKEND_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except Exception:
        pass
    return None


BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or _load_frontend_env() or "").rstrip("/")
assert BASE_URL, "REACT_APP_BACKEND_URL not configured"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@example.com"
ADMIN_PASS = "AdminPass123!"
ADMIN_BDAY = "1990-01-01"


@pytest.fixture(scope="module")
def admin_token():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["stage"] == "birthday"
    stage = d["token"]
    r2 = s.post(f"{API}/auth/verify-birthday",
                headers={"Authorization": f"Bearer {stage}"},
                json={"birthday": ADMIN_BDAY})
    assert r2.status_code == 200, r2.text
    assert r2.json()["stage"] == "complete"
    return r2.json()["token"]


@pytest.fixture(scope="module")
def user_token():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = f"test_{uuid.uuid4().hex[:10]}@test.com"
    r = s.post(f"{API}/auth/register", json={
        "email": email, "password": "TestPass123!", "birthday": "2000-03-20"
    })
    assert r.status_code == 200, r.text
    return r.json()["token"]


# -------- Fix #1: /api/admin/stats --------
def test_admin_stats_requires_auth():
    r = requests.get(f"{API}/admin/stats")
    assert r.status_code in (401, 403), f"expected 401/403, got {r.status_code}: {r.text}"


def test_admin_stats_rejects_non_admin(user_token):
    r = requests.get(f"{API}/admin/stats",
                     headers={"Authorization": f"Bearer {user_token}"})
    assert r.status_code in (401, 403), f"non-admin should be rejected: {r.status_code} {r.text}"


def test_admin_stats_returns_payload(admin_token):
    r = requests.get(f"{API}/admin/stats",
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200, r.text
    data = r.json()
    expected = {"total_users", "total_items", "adv_items", "today_logins",
                "week_logins", "online_now", "vip_active", "hardcore_users", "totp_items"}
    missing = expected - set(data.keys())
    assert not missing, f"missing keys in admin stats: {missing}; got {data}"
    for k in expected:
        assert isinstance(data[k], int), f"{k} should be int, got {type(data[k]).__name__}"


# -------- Smoke: items CRUD regression --------
def test_items_create_and_list_smoke(user_token):
    H = {"Authorization": f"Bearer {user_token}"}
    payload = {"name": "TEST_iter2_smoke", "value": "smokev", "category": "Secret"}
    rc = requests.post(f"{API}/items", headers=H, json=payload)
    assert rc.status_code == 200, rc.text
    iid = rc.json()["id"]
    rl = requests.get(f"{API}/items", headers=H)
    assert rl.status_code == 200
    ids = [i["id"] for i in rl.json()]
    assert iid in ids
    # cleanup
    requests.delete(f"{API}/items/{iid}", headers=H)
