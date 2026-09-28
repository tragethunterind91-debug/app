"""Tests for new features: forgot password/reset, settings autofill, preferences"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


def register_user(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password})
    return r


def login_user(email, password):
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password})
    return r


class TestForgotPasswordReset:
    """Tests for /api/auth/recovery and /api/auth/reset-password"""

    def test_recovery_valid_email(self):
        # Register a fresh user
        email = f"TEST_reset_{uuid.uuid4().hex[:8]}@toppass5.com"
        reg = register_user(email, "Test1234!")
        assert reg.status_code == 200, f"Register failed: {reg.text}"

        # Request recovery
        r = requests.post(f"{BASE_URL}/api/auth/recovery", json={"email": email})
        assert r.status_code == 200, f"Recovery failed: {r.text}"
        data = r.json()
        assert "reset_code" in data, "No reset_code in response"
        assert len(data["reset_code"]) > 10, "reset_code too short"
        print(f"PASS: recovery returns reset_code for {email}")
        return data["reset_code"]

    def test_recovery_unknown_email(self):
        r = requests.post(f"{BASE_URL}/api/auth/recovery", json={"email": "nonexistent_xyz@toppass5.com"})
        # Should return 404 or error
        assert r.status_code in [404, 400], f"Expected error, got {r.status_code}: {r.text}"
        print(f"PASS: recovery returns error for unknown email")

    def test_reset_password_valid_token(self):
        email = f"TEST_resetpwd_{uuid.uuid4().hex[:8]}@toppass5.com"
        reg = register_user(email, "OldPass1234!")
        assert reg.status_code == 200

        rec = requests.post(f"{BASE_URL}/api/auth/recovery", json={"email": email})
        assert rec.status_code == 200
        token = rec.json()["reset_code"]

        new_pwd = "NewPass5678!"
        r = requests.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "new_password": new_pwd})
        assert r.status_code == 200, f"Reset failed: {r.text}"
        print(f"PASS: reset-password succeeded with valid token")

        # Verify login with new password
        login = login_user(email, new_pwd)
        assert login.status_code == 200, f"Login with new password failed: {login.text}"
        print(f"PASS: login with new password works after reset")

    def test_reset_password_invalid_token(self):
        r = requests.post(f"{BASE_URL}/api/auth/reset-password",
                          json={"token": "invalid_token_xyz", "new_password": "NewPass5678!"})
        assert r.status_code in [400, 404, 422], f"Expected error, got {r.status_code}: {r.text}"
        print(f"PASS: reset with invalid token returns error: {r.status_code}")

    def test_reset_password_short_password(self):
        email = f"TEST_resetshort_{uuid.uuid4().hex[:8]}@toppass5.com"
        register_user(email, "Test1234!")
        rec = requests.post(f"{BASE_URL}/api/auth/recovery", json={"email": email})
        token = rec.json()["reset_code"]

        r = requests.post(f"{BASE_URL}/api/auth/reset-password", json={"token": token, "new_password": "short"})
        assert r.status_code in [400, 422], f"Expected validation error, got {r.status_code}"
        print(f"PASS: reset with short password rejected: {r.status_code}")


class TestPreferencesAutofill:
    """Tests for /api/preferences autofill setting"""

    @pytest.fixture
    def auth_token(self):
        email = f"TEST_prefs_{uuid.uuid4().hex[:8]}@toppass5.com"
        r = register_user(email, "Test1234!")
        assert r.status_code == 200
        return r.json()["token"]

    def test_get_preferences_default(self, auth_token):
        r = requests.get(f"{BASE_URL}/api/preferences",
                         headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        data = r.json()
        # autofill may not be set by default but should be accessible
        print(f"PASS: GET preferences returns: {data}")

    def test_save_autofill_false(self, auth_token):
        r = requests.put(f"{BASE_URL}/api/preferences",
                         json={"autofill": False},
                         headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        # Verify it persists
        r2 = requests.get(f"{BASE_URL}/api/preferences",
                          headers={"Authorization": f"Bearer {auth_token}"})
        assert r2.status_code == 200
        data = r2.json()
        assert data.get("autofill") == False, f"autofill should be False, got {data}"
        print(f"PASS: autofill=False persists")

    def test_save_autofill_true(self, auth_token):
        # Set to false first
        requests.put(f"{BASE_URL}/api/preferences",
                     json={"autofill": False},
                     headers={"Authorization": f"Bearer {auth_token}"})
        # Now set back to true
        r = requests.put(f"{BASE_URL}/api/preferences",
                         json={"autofill": True},
                         headers={"Authorization": f"Bearer {auth_token}"})
        assert r.status_code == 200
        r2 = requests.get(f"{BASE_URL}/api/preferences",
                          headers={"Authorization": f"Bearer {auth_token}"})
        assert r2.json().get("autofill") == True
        print(f"PASS: autofill=True persists after toggle back")
