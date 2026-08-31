"""Tests for Layer 3 Crypto-Wallet Recovery Phrase features"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


@pytest.fixture(scope="module")
def registered_user():
    """Register a new user and return email, password, phrase, token"""
    email = f"TEST_phrase_{uuid.uuid4().hex[:8]}@example.com"
    password = "TestPhrase123!"
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password})
    assert r.status_code == 200
    data = r.json()
    return {
        "email": email,
        "password": password,
        "phrase": data["phrase"],
        "token": data["token"],
        "user": data["user"]
    }


class TestRegisterReturnsPhrase:
    """Registration should return a 12-word recovery phrase"""

    def test_register_returns_phrase(self, registered_user):
        phrase = registered_user["phrase"]
        assert phrase is not None
        words = phrase.strip().split()
        assert len(words) == 12, f"Expected 12 words, got {len(words)}"

    def test_register_returns_token_and_user(self, registered_user):
        assert registered_user["token"]
        assert registered_user["user"]["email"] == registered_user["email"].lower()


class TestPhraseLogin:
    """phrase-login endpoint tests"""

    def test_phrase_login_success(self, registered_user):
        r = requests.post(f"{BASE_URL}/api/auth/phrase-login", json={
            "email": registered_user["email"],
            "phrase": registered_user["phrase"]
        })
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == registered_user["email"].lower()

    def test_phrase_login_wrong_phrase(self, registered_user):
        r = requests.post(f"{BASE_URL}/api/auth/phrase-login", json={
            "email": registered_user["email"],
            "phrase": "wrong word one two three four five six seven eight nine ten"
        })
        assert r.status_code == 401

    def test_phrase_login_wrong_email(self, registered_user):
        r = requests.post(f"{BASE_URL}/api/auth/phrase-login", json={
            "email": "nonexistent@example.com",
            "phrase": registered_user["phrase"]
        })
        assert r.status_code == 401


class TestPhraseReset:
    """phrase-reset endpoint tests"""

    def test_phrase_reset_success(self, registered_user):
        new_password = "NewPassword456!"
        r = requests.post(f"{BASE_URL}/api/auth/phrase-reset", json={
            "email": registered_user["email"],
            "phrase": registered_user["phrase"],
            "new_password": new_password
        })
        assert r.status_code == 200
        assert "reset" in r.json().get("message", "").lower()

    def test_login_with_new_password_after_reset(self, registered_user):
        # After reset, login with new password should work
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": registered_user["email"],
            "password": "NewPassword456!"
        })
        assert r.status_code == 200

    def test_phrase_reset_wrong_phrase(self, registered_user):
        r = requests.post(f"{BASE_URL}/api/auth/phrase-reset", json={
            "email": registered_user["email"],
            "phrase": "bad word one two three four five six seven eight nine ten",
            "new_password": "AnotherPass789!"
        })
        assert r.status_code == 401


class TestSetPhrase:
    """set-phrase endpoint for existing users"""

    def test_set_phrase_generates_new_phrase(self, registered_user):
        headers = {"Authorization": f"Bearer {registered_user['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/set-phrase", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "phrase" in data
        words = data["phrase"].strip().split()
        assert len(words) == 12

    def test_set_phrase_requires_auth(self):
        r = requests.post(f"{BASE_URL}/api/auth/set-phrase")
        assert r.status_code == 401

    def test_new_phrase_works_for_login(self, registered_user):
        headers = {"Authorization": f"Bearer {registered_user['token']}"}
        # Generate new phrase
        r = requests.post(f"{BASE_URL}/api/auth/set-phrase", headers=headers)
        new_phrase = r.json()["phrase"]
        # Login with new phrase
        r2 = requests.post(f"{BASE_URL}/api/auth/phrase-login", json={
            "email": registered_user["email"],
            "phrase": new_phrase
        })
        assert r2.status_code == 200
