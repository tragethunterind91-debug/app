"""Iteration 12 backend regression for advance mode, conditional layer3, and hardcore login behavior."""

import os
import uuid
import requests
import pytest


BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")


@pytest.fixture(scope="module")
def api_base_url():
    """Base URL fixture from environment for public endpoint verification."""
    assert BASE_URL, "REACT_APP_BACKEND_URL is required"
    return BASE_URL.rstrip("/")


@pytest.fixture
def api_session():
    """Shared request session per test for stable API calls."""
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def register_user(session, api_base_url, password="Test1234!", birthday="1998-01-02"):
    email = f"TEST_it12_{uuid.uuid4().hex[:10]}@toppass5.com"
    reg = session.post(
        f"{api_base_url}/api/auth/register",
        json={"email": email, "password": password, "birthday": birthday},
    )
    assert reg.status_code == 200, f"register failed: {reg.status_code} {reg.text}"
    body = reg.json()
    assert body["user"]["email"] == email.lower()
    return email, password, birthday, body["token"]


def login_stage_token(session, api_base_url, email, password):
    login = session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": email, "password": password},
    )
    assert login.status_code == 200, f"login failed: {login.status_code} {login.text}"
    data = login.json()
    assert data.get("stage") == "birthday"
    return data["token"], data


def complete_birthday(session, api_base_url, stage_token, birthday):
    return session.post(
        f"{api_base_url}/api/auth/verify-birthday",
        json={"birthday": birthday},
        headers={"Authorization": f"Bearer {stage_token}"},
    )


# Auth stage behavior: birthday -> complete when layer3 disabled.
def test_conditional_crypto_pass_skips_layer3_when_disabled(api_session, api_base_url):
    email, password, birthday, _ = register_user(api_session, api_base_url)
    stage_token, _ = login_stage_token(api_session, api_base_url, email, password)

    verify = complete_birthday(api_session, api_base_url, stage_token, birthday)
    assert verify.status_code == 200
    data = verify.json()
    assert data.get("stage") == "complete"
    assert "quiz_indices" not in data
    assert isinstance(data.get("token"), str) and len(data["token"]) > 20


# Auth stage behavior: birthday -> layer3 quiz when layer3 enabled.
def test_conditional_crypto_pass_prompts_layer3_when_enabled(api_session, api_base_url):
    email, password, birthday, full_token = register_user(api_session, api_base_url)
    auth_headers = {"Authorization": f"Bearer {full_token}"}

    l3 = api_session.get(f"{api_base_url}/api/auth/layer3-passwords", headers=auth_headers)
    assert l3.status_code == 200
    passwords = l3.json()["passwords"]
    assert len(passwords) == 20

    indices = [0, 1, 2]
    answers = {str(i): passwords[i] for i in indices}
    toggle = api_session.post(
        f"{api_base_url}/api/auth/toggle-layer3",
        json={"enabled": True, "quiz_indices": indices, "quiz_answers": answers},
        headers=auth_headers,
    )
    assert toggle.status_code == 200

    stage_token, _ = login_stage_token(api_session, api_base_url, email, password)
    verify = complete_birthday(api_session, api_base_url, stage_token, birthday)
    assert verify.status_code == 200
    data = verify.json()
    assert data.get("stage") == "layer3"
    assert isinstance(data.get("quiz_indices"), list)
    assert len(data["quiz_indices"]) == 3


# Layer3 one-time viewing rules: normal view once, export anytime.
def test_layer3_one_time_view_and_export(api_session, api_base_url):
    _, _, _, token = register_user(api_session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}

    first = api_session.get(f"{api_base_url}/api/auth/layer3-passwords", headers=headers)
    assert first.status_code == 200
    assert len(first.json().get("passwords", [])) == 20

    second = api_session.get(f"{api_base_url}/api/auth/layer3-passwords", headers=headers)
    assert second.status_code == 403

    export = api_session.get(f"{api_base_url}/api/auth/layer3-passwords?for_export=true", headers=headers)
    assert export.status_code == 200
    assert len(export.json().get("passwords", [])) == 20


# Advance mode enforcement on reveal/update/delete/totp and non-advance regression behavior.
def test_advance_mode_protected_endpoints_and_normal_item_regression(api_session, api_base_url):
    _, _, _, token = register_user(api_session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}

    normal_create = api_session.post(
        f"{api_base_url}/api/items",
        headers=headers,
        json={"name": "TEST_NORMAL", "value": "normal-secret", "category": "Secret"},
    )
    assert normal_create.status_code == 200
    normal_id = normal_create.json()["id"]

    advance_create = api_session.post(
        f"{api_base_url}/api/items",
        headers=headers,
        json={
            "name": "TEST_ADV",
            "value": "adv-secret",
            "category": "Secret",
            "totp_secret": "JBSWY3DPEHPK3PXP",
            "advance_mode": True,
            "advance_passphrase": "adv-pass-123",
        },
    )
    assert advance_create.status_code == 200
    adv_id = advance_create.json()["id"]

    blocked_reveal = api_session.get(f"{api_base_url}/api/items/{adv_id}/value", headers=headers)
    assert blocked_reveal.status_code == 403

    update_no_header = api_session.put(
        f"{api_base_url}/api/items/{adv_id}",
        headers=headers,
        json={"name": "TEST_ADV_2", "value": "adv-secret-2", "category": "Secret", "advance_mode": True},
    )
    assert update_no_header.status_code == 401

    update_with_header = api_session.put(
        f"{api_base_url}/api/items/{adv_id}",
        headers={**headers, "X-Advance-Passphrase": "adv-pass-123"},
        json={"name": "TEST_ADV_2", "value": "adv-secret-2", "category": "Secret", "advance_mode": True},
    )
    assert update_with_header.status_code == 200

    totp_no_header = api_session.get(f"{api_base_url}/api/items/{adv_id}/totp", headers=headers)
    assert totp_no_header.status_code == 401

    totp_with_header = api_session.get(
        f"{api_base_url}/api/items/{adv_id}/totp",
        headers={**headers, "X-Advance-Passphrase": "adv-pass-123"},
    )
    assert totp_with_header.status_code == 200
    assert isinstance(totp_with_header.json().get("secret"), str)

    delete_no_header = api_session.delete(f"{api_base_url}/api/items/{adv_id}", headers=headers)
    assert delete_no_header.status_code == 401

    delete_with_header = api_session.delete(
        f"{api_base_url}/api/items/{adv_id}",
        headers={**headers, "X-Advance-Passphrase": "adv-pass-123"},
    )
    assert delete_with_header.status_code == 200

    normal_reveal = api_session.get(f"{api_base_url}/api/items/{normal_id}/value", headers=headers)
    assert normal_reveal.status_code == 200
    assert normal_reveal.json().get("value") == "normal-secret"

    normal_update = api_session.put(
        f"{api_base_url}/api/items/{normal_id}",
        headers=headers,
        json={"name": "TEST_NORMAL_UPD", "value": "normal-secret-2", "category": "Secret"},
    )
    assert normal_update.status_code == 200

    normal_delete = api_session.delete(f"{api_base_url}/api/items/{normal_id}", headers=headers)
    assert normal_delete.status_code == 200


# Advance mode restrictions on share and bulk delete.
def test_advance_mode_share_and_bulk_delete_rejected(api_session, api_base_url):
    _, _, _, token = register_user(api_session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}

    adv = api_session.post(
        f"{api_base_url}/api/items",
        headers=headers,
        json={
            "name": "TEST_ADV_SHARE_BULK",
            "value": "adv-bulk",
            "category": "Secret",
            "advance_mode": True,
            "advance_passphrase": "adv-bulk-pass",
        },
    )
    assert adv.status_code == 200
    adv_id = adv.json()["id"]

    share = api_session.post(f"{api_base_url}/api/items/{adv_id}/share", headers=headers, json={"hours": 1})
    assert share.status_code == 403

    bulk = api_session.post(
        f"{api_base_url}/api/items/bulk-action",
        headers=headers,
        json={"item_ids": [adv_id], "action": "delete"},
    )
    assert bulk.status_code == 403


def test_advance_mode_item_only_lock_then_half_locked_global_block(api_session, api_base_url):
    _, _, _, token = register_user(api_session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}

    item_ids = []
    for idx in range(3):
        created = api_session.post(
            f"{api_base_url}/api/items",
            headers=headers,
            json={
                "name": f"TEST_ADV_LOCK_{idx}",
                "value": f"adv-lock-secret-{idx}",
                "category": "Secret",
                "advance_mode": True,
                "advance_passphrase": f"adv-pass-{idx}",
            },
        )
        assert created.status_code == 200
        item_ids.append(created.json()["id"])

    first_wrong_statuses = []
    for _ in range(4):
        wrong = api_session.post(
            f"{api_base_url}/api/items/{item_ids[0]}/advance-reveal",
            headers=headers,
            json={"passphrase": "wrong-pass"},
        )
        first_wrong_statuses.append(wrong.status_code)
    assert first_wrong_statuses[:3] == [401, 401, 401]
    assert first_wrong_statuses[3] == 423

    second_item_ok = api_session.post(
        f"{api_base_url}/api/items/{item_ids[1]}/advance-reveal",
        headers=headers,
        json={"passphrase": "adv-pass-1"},
    )
    assert second_item_ok.status_code == 200
    assert second_item_ok.json()["value"] == "adv-lock-secret-1"

    second_wrong_responses = []
    for _ in range(4):
        wrong = api_session.post(
            f"{api_base_url}/api/items/{item_ids[1]}/advance-reveal",
            headers=headers,
            json={"passphrase": "wrong-pass"},
        )
        second_wrong_responses.append(wrong)
    assert [resp.status_code for resp in second_wrong_responses[:3]] == [401, 401, 401]
    assert second_wrong_responses[3].status_code == 423
    assert 'Safety block activated' in second_wrong_responses[3].text

    global_block = api_session.post(
        f"{api_base_url}/api/items/{item_ids[2]}/advance-reveal",
        headers=headers,
        json={"passphrase": "adv-pass-2"},
    )
    assert global_block.status_code == 423
    assert 'Advance Mode safety block active' in global_block.text

    me = api_session.get(f"{api_base_url}/api/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json().get('advance_global_locked_until')


# Hardcore mode behavior: configured 4th failed login should delete account.
def test_hardcore_fourth_wrong_login_deletes_account(api_session, api_base_url):
    email, password, _, token = register_user(api_session, api_base_url)
    headers = {"Authorization": f"Bearer {token}"}

    hardcore = api_session.put(
        f"{api_base_url}/api/auth/hardcore-settings",
        headers=headers,
        json={
            "enabled": True,
            "max_login_fail_days": 30,
            "max_login_fails": 4,
            "max_daily_tries": 20,
            "max_layer3_fails": 8,
        },
    )
    assert hardcore.status_code == 200

    r1 = api_session.post(f"{api_base_url}/api/auth/login", json={"email": email, "password": "Wrong!111"})
    r2 = api_session.post(f"{api_base_url}/api/auth/login", json={"email": email, "password": "Wrong!111"})
    r3 = api_session.post(f"{api_base_url}/api/auth/login", json={"email": email, "password": "Wrong!111"})
    r4 = api_session.post(f"{api_base_url}/api/auth/login", json={"email": email, "password": "Wrong!111"})
    assert r1.status_code == 401
    assert r2.status_code == 401
    assert r3.status_code == 401
    assert r4.status_code == 410

    after_delete = api_session.post(f"{api_base_url}/api/auth/login", json={"email": email, "password": password})
    assert after_delete.status_code == 401


# Auth security basics: cookie set, CORS credentials, and 5-fail lockout.
def test_auth_cookie_cors_and_standard_lockout(api_session, api_base_url):
    login = api_session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": "admin@toppass5.com", "password": "TopPass5Owner!2024"},
    )
    assert login.status_code == 200
    set_cookie = login.headers.get("set-cookie", "")
    assert set_cookie
    assert "httponly" in set_cookie.lower()

    preflight = api_session.options(
        f"{api_base_url}/api/auth/login",
        headers={
            "Origin": api_base_url,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type,authorization",
        },
    )
    assert preflight.status_code in [200, 204]
    assert preflight.headers.get("access-control-allow-credentials") == "true"
    assert preflight.headers.get("access-control-allow-origin") != "*"

    email, password, _, _ = register_user(api_session, api_base_url)
    for _ in range(5):
        bad = api_session.post(
            f"{api_base_url}/api/auth/login",
            json={"email": email, "password": "BadWrongPass999!"},
        )
        assert bad.status_code == 401

    locked = api_session.post(
        f"{api_base_url}/api/auth/login",
        json={"email": email, "password": password},
    )
    assert locked.status_code in [423, 429]
