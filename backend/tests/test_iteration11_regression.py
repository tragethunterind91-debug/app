"""Iteration 11 regression tests for TopPass5 requested features and critical auth checks."""

import os
import uuid
import requests
import pytest
from pymongo import MongoClient


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


@pytest.fixture(scope="module")
def api_base_url():
    """Core environment validation for public API base URL."""
    assert BASE_URL, "REACT_APP_BACKEND_URL is required for public endpoint testing"
    return BASE_URL.rstrip("/")


@pytest.fixture(scope="module")
def session():
    """Shared requests session for backend API tests."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def register_user(session, api_base_url, password="Test1234!", birthday="1994-04-14"):
    email = f"TEST_it11_{uuid.uuid4().hex[:10]}@toppass5.com"
    r = session.post(
        f"{api_base_url}/api/auth/register",
        json={"email": email, "password": password, "birthday": birthday},
    )
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text}"
    data = r.json()
    return email, password, data["token"], data


def test_wrong_password_readable_error(session, api_base_url):
    """Auth flow: wrong email/password should return readable error and no crash response."""
    r = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "test@toppass5.com", "password": "WrongPass999!"},
    )
    assert r.status_code == 401
    data = r.json()
    assert isinstance(data.get("detail"), str)
    assert "incorrect" in data["detail"].lower()


def test_admin_login_requires_birthday_stage(session, api_base_url):
    """Admin authentication stage flow with birthday checkpoint."""
    r = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "admin@toppass5.com", "password": "TopPass5Owner!2024"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data.get("stage") == "birthday"
    assert data.get("needs_birthday") is True
    assert isinstance(data.get("token"), str) and len(data["token"]) > 20


def test_admin_birthday_verify_success(session, api_base_url):
    """Admin birthday verification should complete staged login."""
    login = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "admin@toppass5.com", "password": "TopPass5Owner!2024"},
    )
    assert login.status_code == 200
    stage_token = login.json().get("token")
    verify = session.post(
        f"{api_base_url}/api/auth/verify-birthday",
        json={"birthday": "2000-01-01"},
        headers={"Authorization": f"Bearer {stage_token}"},
    )
    assert verify.status_code == 200
    data = verify.json()
    assert data.get("stage") in ["complete", "layer3"]


def test_login_history_last_5_events_shape(session, api_base_url):
    """Settings integration: login history returns max 5 events with timestamp and device."""
    login = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "admin@toppass5.com", "password": "TopPass5Owner!2024"},
    )
    stage_token = login.json().get("token")
    verify = session.post(
        f"{api_base_url}/api/auth/verify-birthday",
        json={"birthday": "2000-01-01"},
        headers={"Authorization": f"Bearer {stage_token}"},
    )
    full_token = verify.json().get("token")
    history = session.get(
        f"{api_base_url}/api/auth/login-history",
        headers={"Authorization": f"Bearer {full_token}"},
    )
    assert history.status_code == 200
    data = history.json()
    assert isinstance(data, list)
    assert len(data) <= 5
    if data:
        first = data[0]
        assert "id" in first and "ts" in first and "device" in first
        assert "_id" not in first
        assert isinstance(first["device"], str) and len(first["device"]) > 0


@pytest.mark.parametrize("minutes", [1, 5, 15, 30])
def test_auto_lock_preferences_roundtrip(session, api_base_url, minutes):
    """Settings preference persistence for auto-lock timer options."""
    _, _, token, _ = register_user(session, api_base_url)
    put = session.put(
        f"{api_base_url}/api/preferences",
        json={"autoLockMinutes": minutes},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put.status_code == 200
    get = session.get(
        f"{api_base_url}/api/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get.status_code == 200
    assert get.json().get("autoLockMinutes") == minutes


def test_theme_preferences_roundtrip(session, api_base_url):
    """Settings preference persistence for dark/light theme."""
    _, _, token, _ = register_user(session, api_base_url)
    put_light = session.put(
        f"{api_base_url}/api/preferences",
        json={"theme": "light"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_light.status_code == 200
    get_light = session.get(
        f"{api_base_url}/api/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_light.status_code == 200
    assert get_light.json().get("theme") == "light"

    put_dark = session.put(
        f"{api_base_url}/api/preferences",
        json={"theme": "dark"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert put_dark.status_code == 200
    get_dark = session.get(
        f"{api_base_url}/api/preferences",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert get_dark.status_code == 200
    assert get_dark.json().get("theme") == "dark"


def test_advance_mode_value_bypass_blocked(session, api_base_url):
    """Advance Mode: direct /value endpoint must reject reveal bypass."""
    _, _, token, _ = register_user(session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}
    create = session.post(
        f"{api_base_url}/api/items",
        headers=headers,
        json={
            "name": "TEST_ADV_ITEM",
            "value": "UltraSecret!234",
            "category": "Secret",
            "advance_mode": True,
            "advance_passphrase": "myAdvancePhrase#1",
        },
    )
    assert create.status_code == 200
    item_id = create.json()["id"]

    bypass = session.get(f"{api_base_url}/api/items/{item_id}/value", headers=headers)
    assert bypass.status_code == 403

    wrong = session.post(
        f"{api_base_url}/api/items/{item_id}/advance-reveal",
        headers=headers,
        json={"passphrase": "wrong-pass"},
    )
    assert wrong.status_code == 401

    good = session.post(
        f"{api_base_url}/api/items/{item_id}/advance-reveal",
        headers=headers,
        json={"passphrase": "myAdvancePhrase#1"},
    )
    assert good.status_code == 200
    assert good.json().get("value") == "UltraSecret!234"


def test_layer3_one_time_view_and_export_still_allowed(session, api_base_url):
    """Layer 3 one-time on-screen view policy plus export endpoint behavior."""
    _, _, token, _ = register_user(session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}

    first = session.get(f"{api_base_url}/api/auth/layer3-passwords", headers=headers)
    assert first.status_code == 200
    first_data = first.json()
    assert isinstance(first_data.get("passwords"), list)
    assert len(first_data["passwords"]) == 20

    second = session.get(f"{api_base_url}/api/auth/layer3-passwords", headers=headers)
    assert second.status_code == 403

    exported = session.get(f"{api_base_url}/api/auth/layer3-passwords?for_export=true", headers=headers)
    assert exported.status_code == 200
    assert len(exported.json().get("passwords", [])) == 20


def test_auth_login_sets_http_only_cookie(session, api_base_url):
    """Auth playbook: login should set httpOnly cookie (expected fail if not implemented)."""
    r = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "admin@toppass5.com", "password": "TopPass5Owner!2024"},
    )
    assert r.status_code == 200
    set_cookie = r.headers.get("set-cookie", "")
    assert set_cookie, "No Set-Cookie header found on login response"
    assert "httponly" in set_cookie.lower()


def test_cors_credentials_not_wildcard_origin(session, api_base_url):
    """Auth playbook: CORS with credentials should use explicit origin, not '*' ."""
    origin = "https://example.test"
    resp = session.options(
        f"{api_base_url}/api/auth/login",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert resp.status_code in [200, 204]
    allow_creds = resp.headers.get("access-control-allow-credentials")
    allow_origin = resp.headers.get("access-control-allow-origin")
    assert allow_creds == "true"
    assert allow_origin != "*", "CORS origin is wildcard while credentials are enabled"


def test_bruteforce_lockout_after_5_fails(session, api_base_url):
    """Auth playbook: account should lock after 5 failed attempts (expected fail if policy not implemented)."""
    email, password, _, _ = register_user(session, api_base_url)

    for _ in range(5):
        wrong = session.post(
            f"{api_base_url}/api/auth/login",
            json={"email": email, "password": "WrongPassword!111"},
        )
        assert wrong.status_code == 401

    locked = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": email, "password": password},
    )
    assert locked.status_code in [423, 429], (
        f"Expected lockout status after 5 fails, got {locked.status_code}"
    )


def test_bcrypt_hash_prefix_in_db():
    """Auth playbook: stored password hash should use bcrypt format starting with $2b$."""
    mongo_url = os.environ.get("MONGO_URL")
    db_name = os.environ.get("DB_NAME")
    assert mongo_url and db_name, "MONGO_URL and DB_NAME are required"

    mc = MongoClient(mongo_url)
    doc = mc[db_name]["users"].find_one({"email": "admin@toppass5.com"}, {"password": 1, "_id": 0})
    assert doc and isinstance(doc.get("password"), str)
    assert doc["password"].startswith("$2b$")
