"""Backend API tests for TopPass5 Encrypted Secrets Vault."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://toppass5-vault.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "admin@toppass5.local"
ADMIN_PASS = "AdminPass123!"
ADMIN_BDAY = "1990-01-15"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def new_user(session):
    """Register a fresh user and return credentials + full-access token."""
    email = f"test_{uuid.uuid4().hex[:10]}@test.com"
    password = "TestPass123!"
    birthday = "2000-03-20"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": password, "birthday": birthday
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert "token" in data and "user" in data
    assert data["user"]["email"] == email
    return {"email": email, "password": password, "birthday": birthday, "token": data["token"], "user": data["user"]}


# -------- Health --------
def test_api_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200
    assert "message" in r.json()


# -------- Auth --------
class TestAuth:
    def test_register_requires_birthday(self, session):
        r = session.post(f"{API}/auth/register", json={
            "email": f"test_{uuid.uuid4().hex[:8]}@test.com",
            "password": "NoBirth123!",
        })
        assert r.status_code == 400

    def test_register_duplicate(self, session, new_user):
        r = session.post(f"{API}/auth/register", json={
            "email": new_user["email"], "password": "AnyPass123!", "birthday": "2000-01-01"
        })
        assert r.status_code == 409

    def test_login_wrong_password(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": "WrongPass999!"
        })
        assert r.status_code == 401

    def test_login_then_birthday_flow(self, session, new_user):
        r = session.post(f"{API}/auth/login", json={
            "email": new_user["email"], "password": new_user["password"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["stage"] == "birthday"
        assert d["needs_birthday"] is True
        stage_token = d["token"]
        # wrong birthday
        r2 = session.post(f"{API}/auth/verify-birthday",
                          headers={"Authorization": f"Bearer {stage_token}"},
                          json={"birthday": "1900-01-01"})
        assert r2.status_code == 401
        # correct birthday
        r3 = session.post(f"{API}/auth/verify-birthday",
                          headers={"Authorization": f"Bearer {stage_token}"},
                          json={"birthday": new_user["birthday"]})
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        assert d3["stage"] == "complete"
        assert "token" in d3

    def test_me(self, session, new_user):
        r = session.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"]

    def test_admin_login_full_flow(self, session):
        r = session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        if r.status_code == 401:
            pytest.skip("Admin account not seeded")
        assert r.status_code == 200, r.text
        stage_token = r.json()["token"]
        r2 = session.post(f"{API}/auth/verify-birthday",
                          headers={"Authorization": f"Bearer {stage_token}"},
                          json={"birthday": ADMIN_BDAY})
        assert r2.status_code == 200, r2.text
        token = r2.json()["token"]
        # Admin stats
        rs = session.get(f"{API}/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert rs.status_code == 200
        assert "users" in rs.json() or "total_users" in rs.json() or isinstance(rs.json(), dict)


# -------- Items CRUD --------
class TestItems:
    def test_create_list_reveal_update_delete(self, session, new_user):
        token = new_user["token"]
        H = {"Authorization": f"Bearer {token}"}

        # Create
        payload = {"name": "TEST_GmailPass", "value": "s3cret!val", "category": "Email"}
        rc = session.post(f"{API}/items", headers=H, json=payload)
        assert rc.status_code == 200, rc.text
        item = rc.json()
        assert item["name"] == "TEST_GmailPass"
        assert item["category"] == "Email"
        assert "id" in item
        iid = item["id"]
        # Value should NOT be returned on list/create (encrypted)
        assert item.get("value") in (None, "", "***") or "value" not in item

        # List
        rl = session.get(f"{API}/items", headers=H)
        assert rl.status_code == 200
        ids = [i["id"] for i in rl.json()]
        assert iid in ids

        # Reveal value
        rv = session.get(f"{API}/items/{iid}/value", headers=H)
        assert rv.status_code == 200, rv.text
        assert rv.json().get("value") == "s3cret!val"

        # Update
        ru = session.put(f"{API}/items/{iid}", headers=H, json={
            "name": "TEST_GmailPass2", "value": "newval99", "category": "Email"
        })
        assert ru.status_code == 200, ru.text
        # verify update
        rv2 = session.get(f"{API}/items/{iid}/value", headers=H)
        assert rv2.json().get("value") == "newval99"

        # Delete
        rd = session.delete(f"{API}/items/{iid}", headers=H)
        assert rd.status_code in (200, 204)
        rl2 = session.get(f"{API}/items", headers=H)
        assert iid not in [i["id"] for i in rl2.json()]

    def test_items_requires_auth(self, session):
        r = session.get(f"{API}/items")
        assert r.status_code in (401, 403)

    def test_share_link(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        rc = session.post(f"{API}/items", headers=H, json={
            "name": "TEST_ShareItem", "value": "sharedval", "category": "Secret"
        })
        iid = rc.json()["id"]
        rs = session.post(f"{API}/items/{iid}/share", headers=H, json={"hours": 1})
        assert rs.status_code == 200, rs.text
        token = rs.json().get("token") or rs.json().get("share_token") or rs.json().get("url", "").split("=")[-1]
        assert token
        rg = session.get(f"{API}/share/{token}")
        assert rg.status_code == 200, rg.text
        # Cleanup
        session.delete(f"{API}/items/{iid}", headers=H)


# -------- Security/Preferences/Audit --------
class TestMisc:
    def test_security_report(self, session, new_user):
        r = session.get(f"{API}/security/report", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200

    def test_preferences_get_put(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        r1 = session.get(f"{API}/preferences", headers=H)
        assert r1.status_code == 200
        r2 = session.put(f"{API}/preferences", headers=H, json={"theme": "dark"})
        assert r2.status_code == 200

    def test_audit_log(self, session, new_user):
        r = session.get(f"{API}/audit", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_layer3_passwords(self, session, new_user):
        r = session.get(f"{API}/auth/layer3-passwords", headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        data = r.json()
        # Should contain 20 passwords
        pw = data.get("passwords") or data
        if isinstance(pw, list):
            assert len(pw) == 20
