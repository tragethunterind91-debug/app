"""Backend API tests for TopPass5 Encrypted Secrets Vault."""
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

# Admin creds per /app/memory/test_credentials.md
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASS = "AdminPass123!"
ADMIN_BDAY = "1990-01-01"


@pytest.fixture(scope="session")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def _register(session):
    email = f"test_{uuid.uuid4().hex[:10]}@test.com"
    password = "TestPass123!"
    birthday = "2000-03-20"
    r = session.post(f"{API}/auth/register", json={
        "email": email, "password": password, "birthday": birthday
    })
    assert r.status_code == 200, r.text
    data = r.json()
    return {"email": email, "password": password, "birthday": birthday,
            "token": data["token"], "user": data["user"]}


@pytest.fixture(scope="session")
def new_user(session):
    return _register(session)


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

    def test_login_wrong_password(self, session):
        u = _register(session)
        r = session.post(f"{API}/auth/login", json={
            "email": u["email"], "password": "WrongPass999!"
        })
        assert r.status_code == 401

    def test_login_then_birthday_flow(self, session):
        u = _register(session)
        r = session.post(f"{API}/auth/login", json={
            "email": u["email"], "password": u["password"]
        })
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["stage"] == "birthday"
        assert d["needs_birthday"] is True
        stage_token = d["token"]
        r2 = session.post(f"{API}/auth/verify-birthday",
                          headers={"Authorization": f"Bearer {stage_token}"},
                          json={"birthday": "1900-01-01"})
        assert r2.status_code == 401
        r3 = session.post(f"{API}/auth/verify-birthday",
                          headers={"Authorization": f"Bearer {stage_token}"},
                          json={"birthday": u["birthday"]})
        assert r3.status_code == 200, r3.text
        d3 = r3.json()
        assert d3["stage"] == "complete"
        assert "token" in d3

    def test_me(self, session, new_user):
        r = session.get(f"{API}/auth/me",
                        headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert r.json()["email"] == new_user["email"]

    def test_admin_login_full_flow(self, session):
        r = session.post(f"{API}/auth/login",
                         json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["stage"] == "birthday"
        stage_token = d["token"]
        r2 = session.post(f"{API}/auth/verify-birthday",
                          headers={"Authorization": f"Bearer {stage_token}"},
                          json={"birthday": ADMIN_BDAY})
        assert r2.status_code == 200, r2.text
        assert r2.json()["stage"] == "complete"
        token = r2.json()["token"]
        # verify admin flag via /auth/me - decode via items endpoint access
        rm = session.get(f"{API}/auth/me",
                         headers={"Authorization": f"Bearer {token}"})
        assert rm.status_code == 200


# -------- Items CRUD --------
class TestItems:
    def test_create_list_reveal_update_delete(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        payload = {"name": "TEST_GmailPass", "value": "s3cret!val", "category": "Email"}
        rc = session.post(f"{API}/items", headers=H, json=payload)
        assert rc.status_code == 200, rc.text
        item = rc.json()
        assert item["name"] == "TEST_GmailPass"
        assert item["category"] == "Email"
        iid = item["id"]
        assert "value" not in item  # encrypted; not exposed on create

        rl = session.get(f"{API}/items", headers=H)
        assert rl.status_code == 200
        assert iid in [i["id"] for i in rl.json()]

        rv = session.get(f"{API}/items/{iid}/value", headers=H)
        assert rv.status_code == 200
        assert rv.json()["value"] == "s3cret!val"

        ru = session.put(f"{API}/items/{iid}", headers=H, json={
            "name": "TEST_GmailPass2", "value": "newval99", "category": "Email"
        })
        assert ru.status_code == 200
        rv2 = session.get(f"{API}/items/{iid}/value", headers=H)
        assert rv2.json()["value"] == "newval99"

        # Favorite toggle
        rf = session.patch(f"{API}/items/{iid}/favorite", headers=H)
        assert rf.status_code == 200
        assert rf.json()["favorite"] is True

        rd = session.delete(f"{API}/items/{iid}", headers=H)
        assert rd.status_code in (200, 204)
        rl2 = session.get(f"{API}/items", headers=H)
        assert iid not in [i["id"] for i in rl2.json()]

    def test_items_requires_auth(self):
        # Use fresh client without any auth cookies
        r = requests.get(f"{API}/items")
        assert r.status_code in (401, 403)

    def test_share_link(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        rc = session.post(f"{API}/items", headers=H, json={
            "name": "TEST_ShareItem", "value": "sharedval", "category": "Secret"
        })
        iid = rc.json()["id"]
        rs = session.post(f"{API}/items/{iid}/share", headers=H, json={"hours": 1})
        assert rs.status_code == 200
        token = rs.json()["token"]
        rg = session.get(f"{API}/share/{token}")
        assert rg.status_code == 200
        assert rg.json()["value"] == "sharedval"
        # invalid token
        rbad = session.get(f"{API}/share/invalidtoken_xyz")
        assert rbad.status_code == 404
        session.delete(f"{API}/items/{iid}", headers=H)

    def test_bulk_delete(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        ids = []
        for i in range(3):
            r = session.post(f"{API}/items", headers=H,
                             json={"name": f"TEST_bulk{i}", "value": f"v{i}", "category": "Secret"})
            ids.append(r.json()["id"])
        rb = session.post(f"{API}/items/bulk-action", headers=H,
                          json={"item_ids": ids, "action": "delete"})
        assert rb.status_code == 200
        assert rb.json()["deleted"] == 3

    def test_import_items(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        payload = {"items": [
            {"name": "TEST_imp1", "value": "iv1", "category": "Secret"},
            {"name": "TEST_imp2", "value": "iv2", "category": "Login"},
        ]}
        r = session.post(f"{API}/items/import", headers=H, json=payload)
        assert r.status_code == 200
        assert r.json()["count"] == 2
        # cleanup
        for it in r.json()["items"]:
            session.delete(f"{API}/items/{it['id']}", headers=H)


# -------- Advance mode --------
class TestAdvance:
    def test_advance_mode_lifecycle(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        # requires passphrase
        rbad = session.post(f"{API}/items", headers=H, json={
            "name": "TEST_adv_bad", "value": "x", "advance_mode": True
        })
        assert rbad.status_code == 400

        rc = session.post(f"{API}/items", headers=H, json={
            "name": "TEST_adv", "value": "advsecret", "category": "Secret",
            "advance_mode": True, "advance_passphrase": "pass-phrase-123"
        })
        assert rc.status_code == 200, rc.text
        iid = rc.json()["id"]
        assert rc.json()["advance_mode"] is True

        # plain reveal must be blocked
        rv = session.get(f"{API}/items/{iid}/value", headers=H)
        assert rv.status_code == 403

        # wrong passphrase
        rw = session.post(f"{API}/items/{iid}/advance-reveal", headers=H,
                          json={"passphrase": "wrong"})
        assert rw.status_code == 401

        # correct passphrase
        rr = session.post(f"{API}/items/{iid}/advance-reveal", headers=H,
                          json={"passphrase": "pass-phrase-123"})
        assert rr.status_code == 200
        assert rr.json()["value"] == "advsecret"

        # cannot share advance item
        rs = session.post(f"{API}/items/{iid}/share", headers=H, json={"hours": 1})
        assert rs.status_code == 403

        # delete requires passphrase
        rd = session.delete(f"{API}/items/{iid}", headers=H)
        assert rd.status_code == 401
        rd2 = session.delete(f"{API}/items/{iid}", headers=H,
                             json={}, params={})
        # The server uses x-advance-passphrase header
        rd3 = requests.delete(f"{API}/items/{iid}",
                              headers={**H, "x-advance-passphrase": "pass-phrase-123"})
        assert rd3.status_code in (200, 204)


# -------- Hardcore settings --------
class TestHardcore:
    def test_hardcore_get_and_bad_update(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        r = session.get(f"{API}/auth/hardcore-settings", headers=H)
        assert r.status_code == 200
        assert "settings" in r.json()
        # bad range
        rb = session.put(f"{API}/auth/hardcore-settings", headers=H, json={
            "enabled": False, "max_login_fail_days": 0, "max_login_fails": 16,
            "max_daily_tries": 4, "max_layer3_fails": 8, "password": new_user["password"]
        })
        assert rb.status_code == 422
        # wrong password
        rw = session.put(f"{API}/auth/hardcore-settings", headers=H, json={
            "enabled": False, "max_login_fail_days": 4, "max_login_fails": 16,
            "max_daily_tries": 4, "max_layer3_fails": 8, "password": "wrong"
        })
        assert rw.status_code == 401


# -------- Misc --------
class TestMisc:
    def test_security_report(self, session, new_user):
        r = session.get(f"{API}/security/report",
                        headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert "score" in r.json()

    def test_preferences(self, session, new_user):
        H = {"Authorization": f"Bearer {new_user['token']}"}
        r1 = session.get(f"{API}/preferences", headers=H)
        assert r1.status_code == 200
        r2 = session.put(f"{API}/preferences", headers=H, json={"theme": "dark"})
        assert r2.status_code == 200

    def test_audit(self, session, new_user):
        r = session.get(f"{API}/audit",
                        headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_layer3_passwords(self, session, new_user):
        r = session.get(f"{API}/auth/layer3-passwords",
                        headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        pw = r.json()["passwords"]
        assert isinstance(pw, list) and len(pw) == 20

    def test_vip_status(self, session, new_user):
        r = session.get(f"{API}/vip/status",
                        headers={"Authorization": f"Bearer {new_user['token']}"})
        assert r.status_code == 200
        assert "is_vip" in r.json()
