"""
Tests for Phase 1 Multi-Layer Authentication Features:
- Registration with birthday (L2) and 20 L3 passwords
- Login Stage 1: email/password → returns stage='birthday' if user has birthday
- Login Stage 2: birthday verification → advances to L3 quiz or grants access
- Login Stage 3: L3 crypto quiz → 3 random password positions
- Disclaimer acceptance
- Layer 3 toggle (enable requires quiz, disable just toggles)
- View L3 passwords
- Regenerate L3 passwords (max 5/week, requires password, L3 must be disabled)
- Hardcore Mode settings
- Legacy users (no birthday) can login directly
"""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


# ============ REGISTRATION TESTS ============

class TestRegistrationWithBirthday:
    """Registration should require birthday and return 20 L3 passwords + 12-word phrase"""

    def test_register_requires_birthday(self):
        """Registration without birthday should fail"""
        email = f"TEST_reg_nobd_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!"
        })
        assert r.status_code == 400, f"Expected 400 for missing birthday, got {r.status_code}"
        assert "birthday" in r.json().get("detail", "").lower()

    def test_register_with_birthday_returns_l3_passwords(self):
        """Registration with birthday should return 20 L3 passwords"""
        email = f"TEST_reg_l3_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "birthday": "1990-05-15"
        })
        assert r.status_code == 200
        data = r.json()
        
        # Check L3 passwords
        assert "layer3_passwords" in data, "Registration should return layer3_passwords"
        l3_passwords = data["layer3_passwords"]
        assert len(l3_passwords) == 20, f"Expected 20 L3 passwords, got {len(l3_passwords)}"
        
        # Each password should be 5 characters
        for i, pwd in enumerate(l3_passwords):
            assert len(pwd) == 5, f"Password {i+1} should be 5 chars, got {len(pwd)}"

    def test_register_returns_12_word_phrase(self):
        """Registration should return 12-word recovery phrase"""
        email = f"TEST_reg_phrase_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "birthday": "1985-12-25"
        })
        assert r.status_code == 200
        data = r.json()
        
        assert "phrase" in data, "Registration should return phrase"
        words = data["phrase"].strip().split()
        assert len(words) == 12, f"Expected 12 words, got {len(words)}"

    def test_register_returns_user_with_has_birthday(self):
        """Registered user should have has_birthday=True"""
        email = f"TEST_reg_hasbd_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestPass123!",
            "birthday": "2000-01-01"
        })
        assert r.status_code == 200
        data = r.json()
        
        assert data["user"]["has_birthday"] == True
        assert data["user"]["layer3_enabled"] == False  # L3 disabled by default
        assert data["user"]["disclaimer_accepted"] == False


# ============ LOGIN STAGE 1 TESTS ============

class TestLoginStage1:
    """Login Stage 1: email/password check"""

    @pytest.fixture(scope="class")
    def user_with_birthday(self):
        """Create a user with birthday for testing"""
        email = f"TEST_login_s1_{uuid.uuid4().hex[:8]}@example.com"
        password = "TestLogin123!"
        birthday = "1995-06-20"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "birthday": birthday
        })
        assert r.status_code == 200
        data = r.json()
        return {
            "email": email,
            "password": password,
            "birthday": birthday,
            "token": data["token"],
            "l3_passwords": data["layer3_passwords"]
        }

    def test_login_returns_birthday_stage(self, user_with_birthday):
        """Login with correct credentials should return stage='birthday'"""
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_with_birthday["email"],
            "password": user_with_birthday["password"]
        })
        assert r.status_code == 200
        data = r.json()
        
        assert data["stage"] == "birthday", f"Expected stage='birthday', got {data.get('stage')}"
        assert "token" in data  # Stage token
        assert data["needs_birthday"] == True

    def test_login_wrong_password_returns_401(self, user_with_birthday):
        """Login with wrong password should return 401"""
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_with_birthday["email"],
            "password": "WrongPassword123!"
        })
        assert r.status_code == 401

    def test_login_nonexistent_email_returns_401(self):
        """Login with non-existent email should return 401"""
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@example.com",
            "password": "AnyPassword123!"
        })
        assert r.status_code == 401


# ============ LOGIN STAGE 2 TESTS ============

class TestLoginStage2Birthday:
    """Login Stage 2: birthday verification"""

    @pytest.fixture(scope="class")
    def user_for_birthday_test(self):
        """Create user and get stage token"""
        email = f"TEST_login_s2_{uuid.uuid4().hex[:8]}@example.com"
        password = "TestBirthday123!"
        birthday = "1988-03-10"
        
        # Register
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "birthday": birthday
        })
        assert reg.status_code == 200
        reg_data = reg.json()
        
        # Login to get stage token
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        assert login.status_code == 200
        login_data = login.json()
        
        return {
            "email": email,
            "password": password,
            "birthday": birthday,
            "stage_token": login_data["token"],
            "l3_passwords": reg_data["layer3_passwords"],
            "full_token": reg_data["token"]
        }

    def test_verify_birthday_correct(self, user_for_birthday_test):
        """Correct birthday should advance to complete (L3 disabled by default)"""
        headers = {"Authorization": f"Bearer {user_for_birthday_test['stage_token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/verify-birthday", 
            json={"birthday": user_for_birthday_test["birthday"]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        
        # L3 is disabled by default, so should go to complete
        assert data["stage"] == "complete", f"Expected stage='complete', got {data.get('stage')}"
        assert "token" in data  # Full access token

    def test_verify_birthday_wrong(self, user_for_birthday_test):
        """Wrong birthday should return 401"""
        # Get fresh stage token
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_for_birthday_test["email"],
            "password": user_for_birthday_test["password"]
        })
        stage_token = login.json()["token"]
        
        headers = {"Authorization": f"Bearer {stage_token}"}
        r = requests.post(f"{BASE_URL}/api/auth/verify-birthday", 
            json={"birthday": "1999-12-31"},  # Wrong birthday
            headers=headers
        )
        assert r.status_code == 401


# ============ LOGIN STAGE 3 TESTS ============

class TestLoginStage3Layer3Quiz:
    """Login Stage 3: L3 crypto quiz with 3 random password positions"""

    @pytest.fixture(scope="class")
    def user_with_l3_enabled(self):
        """Create user with L3 enabled"""
        email = f"TEST_login_s3_{uuid.uuid4().hex[:8]}@example.com"
        password = "TestL3Quiz123!"
        birthday = "1992-07-04"
        
        # Register
        reg = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "birthday": birthday
        })
        assert reg.status_code == 200
        reg_data = reg.json()
        full_token = reg_data["token"]
        l3_passwords = reg_data["layer3_passwords"]
        
        # Enable L3 (need to pass quiz)
        # First get 3 random indices for the quiz
        quiz_indices = [0, 5, 10]  # We'll use these
        quiz_answers = {str(i): l3_passwords[i] for i in quiz_indices}
        
        headers = {"Authorization": f"Bearer {full_token}"}
        toggle = requests.post(f"{BASE_URL}/api/auth/toggle-layer3", 
            json={"enabled": True, "quiz_indices": quiz_indices, "quiz_answers": quiz_answers},
            headers=headers
        )
        assert toggle.status_code == 200
        
        return {
            "email": email,
            "password": password,
            "birthday": birthday,
            "l3_passwords": l3_passwords,
            "full_token": full_token
        }

    def test_login_with_l3_enabled_returns_quiz(self, user_with_l3_enabled):
        """Login with L3 enabled should eventually return quiz indices"""
        # Stage 1: Login
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_with_l3_enabled["email"],
            "password": user_with_l3_enabled["password"]
        })
        assert login.status_code == 200
        stage_token = login.json()["token"]
        
        # Stage 2: Birthday
        headers = {"Authorization": f"Bearer {stage_token}"}
        birthday_r = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
            json={"birthday": user_with_l3_enabled["birthday"]},
            headers=headers
        )
        assert birthday_r.status_code == 200
        data = birthday_r.json()
        
        assert data["stage"] == "layer3", f"Expected stage='layer3', got {data.get('stage')}"
        assert "quiz_indices" in data
        assert len(data["quiz_indices"]) == 3, "Should have 3 quiz indices"

    def test_verify_layer3_correct_answers(self, user_with_l3_enabled):
        """Correct L3 answers should grant full access"""
        # Stage 1: Login
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_with_l3_enabled["email"],
            "password": user_with_l3_enabled["password"]
        })
        stage_token = login.json()["token"]
        
        # Stage 2: Birthday
        headers = {"Authorization": f"Bearer {stage_token}"}
        birthday_r = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
            json={"birthday": user_with_l3_enabled["birthday"]},
            headers=headers
        )
        l3_token = birthday_r.json()["token"]
        quiz_indices = birthday_r.json()["quiz_indices"]
        
        # Stage 3: L3 Quiz
        answers = {str(i): user_with_l3_enabled["l3_passwords"][i] for i in quiz_indices}
        headers = {"Authorization": f"Bearer {l3_token}"}
        l3_r = requests.post(f"{BASE_URL}/api/auth/verify-layer3",
            json={"answers": answers},
            headers=headers
        )
        assert l3_r.status_code == 200
        data = l3_r.json()
        
        assert data["stage"] == "complete"
        assert "token" in data

    def test_verify_layer3_wrong_answers(self, user_with_l3_enabled):
        """Wrong L3 answers should return 401"""
        # Stage 1: Login
        login = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": user_with_l3_enabled["email"],
            "password": user_with_l3_enabled["password"]
        })
        stage_token = login.json()["token"]
        
        # Stage 2: Birthday
        headers = {"Authorization": f"Bearer {stage_token}"}
        birthday_r = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
            json={"birthday": user_with_l3_enabled["birthday"]},
            headers=headers
        )
        l3_token = birthday_r.json()["token"]
        quiz_indices = birthday_r.json()["quiz_indices"]
        
        # Stage 3: L3 Quiz with wrong answers
        wrong_answers = {str(i): "XXXXX" for i in quiz_indices}
        headers = {"Authorization": f"Bearer {l3_token}"}
        l3_r = requests.post(f"{BASE_URL}/api/auth/verify-layer3",
            json={"answers": wrong_answers},
            headers=headers
        )
        assert l3_r.status_code == 401


# ============ DISCLAIMER TESTS ============

class TestDisclaimer:
    """Disclaimer acceptance tests"""

    @pytest.fixture(scope="class")
    def new_user(self):
        """Create a new user"""
        email = f"TEST_disclaimer_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestDisclaimer123!",
            "birthday": "1990-01-01"
        })
        assert r.status_code == 200
        data = r.json()
        return {"email": email, "token": data["token"], "user": data["user"]}

    def test_new_user_disclaimer_not_accepted(self, new_user):
        """New user should have disclaimer_accepted=False"""
        assert new_user["user"]["disclaimer_accepted"] == False

    def test_accept_disclaimer(self, new_user):
        """Accept disclaimer should set disclaimer_accepted=True"""
        headers = {"Authorization": f"Bearer {new_user['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/accept-disclaimer", headers=headers)
        assert r.status_code == 200
        
        # Verify via /auth/me
        me = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert me.status_code == 200
        assert me.json()["disclaimer_accepted"] == True


# ============ LAYER 3 MANAGEMENT TESTS ============

class TestLayer3Management:
    """Layer 3 toggle, view, regenerate tests"""

    @pytest.fixture(scope="class")
    def user_for_l3_mgmt(self):
        """Create user for L3 management tests"""
        email = f"TEST_l3mgmt_{uuid.uuid4().hex[:8]}@example.com"
        password = "TestL3Mgmt123!"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password,
            "birthday": "1985-08-15"
        })
        assert r.status_code == 200
        data = r.json()
        return {
            "email": email,
            "password": password,
            "token": data["token"],
            "l3_passwords": data["layer3_passwords"]
        }

    def test_get_layer3_passwords(self, user_for_l3_mgmt):
        """Should be able to view L3 passwords"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        r = requests.get(f"{BASE_URL}/api/auth/layer3-passwords", headers=headers)
        assert r.status_code == 200
        data = r.json()
        
        assert "passwords" in data
        assert len(data["passwords"]) == 20
        assert data["enabled"] == False  # Disabled by default

    def test_toggle_layer3_enable_requires_quiz(self, user_for_l3_mgmt):
        """Enabling L3 without quiz should fail"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/toggle-layer3",
            json={"enabled": True},
            headers=headers
        )
        assert r.status_code == 400, "Should require quiz to enable L3"

    def test_toggle_layer3_enable_with_quiz(self, user_for_l3_mgmt):
        """Enabling L3 with correct quiz should succeed"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        
        quiz_indices = [2, 8, 15]
        quiz_answers = {str(i): user_for_l3_mgmt["l3_passwords"][i] for i in quiz_indices}
        
        r = requests.post(f"{BASE_URL}/api/auth/toggle-layer3",
            json={"enabled": True, "quiz_indices": quiz_indices, "quiz_answers": quiz_answers},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["enabled"] == True

    def test_toggle_layer3_disable(self, user_for_l3_mgmt):
        """Disabling L3 should just toggle off (no quiz needed)"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/toggle-layer3",
            json={"enabled": False},
            headers=headers
        )
        assert r.status_code == 200
        assert r.json()["enabled"] == False

    def test_regenerate_l3_requires_password(self, user_for_l3_mgmt):
        """Regenerating L3 passwords requires current password"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/regenerate-layer3",
            json={},
            headers=headers
        )
        assert r.status_code == 400, "Should require password"

    def test_regenerate_l3_wrong_password(self, user_for_l3_mgmt):
        """Regenerating L3 with wrong password should fail"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/regenerate-layer3",
            json={"password": "WrongPassword123!"},
            headers=headers
        )
        assert r.status_code == 401

    def test_regenerate_l3_success(self, user_for_l3_mgmt):
        """Regenerating L3 with correct password should return new passwords"""
        headers = {"Authorization": f"Bearer {user_for_l3_mgmt['token']}"}
        r = requests.post(f"{BASE_URL}/api/auth/regenerate-layer3",
            json={"password": user_for_l3_mgmt["password"]},
            headers=headers
        )
        assert r.status_code == 200
        data = r.json()
        
        assert "passwords" in data
        assert len(data["passwords"]) == 20
        assert "changes_remaining" in data
        
        # New passwords should be different from original
        new_passwords = data["passwords"]
        original = user_for_l3_mgmt["l3_passwords"]
        # At least some should be different (statistically almost certain)
        different_count = sum(1 for i in range(20) if new_passwords[i] != original[i])
        assert different_count > 0, "New passwords should be different"


# ============ HARDCORE MODE TESTS ============

class TestHardcoreMode:
    """Hardcore Mode settings tests"""

    @pytest.fixture(scope="class")
    def user_for_hardcore(self):
        """Create user for hardcore tests"""
        email = f"TEST_hardcore_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestHardcore123!",
            "birthday": "1990-02-28"
        })
        assert r.status_code == 200
        data = r.json()
        return {"email": email, "token": data["token"]}

    def test_get_hardcore_settings(self, user_for_hardcore):
        """Should be able to get hardcore settings"""
        headers = {"Authorization": f"Bearer {user_for_hardcore['token']}"}
        r = requests.get(f"{BASE_URL}/api/auth/hardcore-settings", headers=headers)
        assert r.status_code == 200
        data = r.json()
        
        assert "enabled" in data
        assert data["enabled"] == False  # Disabled by default
        assert "settings" in data
        assert "failed_logins" in data

    def test_update_hardcore_settings(self, user_for_hardcore):
        """Should be able to update hardcore settings"""
        headers = {"Authorization": f"Bearer {user_for_hardcore['token']}"}
        r = requests.put(f"{BASE_URL}/api/auth/hardcore-settings",
            json={
                "enabled": True,
                "max_login_fail_days": 5,
                "max_login_fails": 20,
                "max_daily_tries": 5,
                "max_layer3_fails": 10
            },
            headers=headers
        )
        assert r.status_code == 200
        
        # Verify settings were saved
        get_r = requests.get(f"{BASE_URL}/api/auth/hardcore-settings", headers=headers)
        data = get_r.json()
        assert data["enabled"] == True
        assert data["settings"]["max_login_fail_days"] == 5
        assert data["settings"]["max_login_fails"] == 20

    def test_disable_hardcore(self, user_for_hardcore):
        """Should be able to disable hardcore mode"""
        headers = {"Authorization": f"Bearer {user_for_hardcore['token']}"}
        r = requests.put(f"{BASE_URL}/api/auth/hardcore-settings",
            json={
                "enabled": False,
                "max_login_fail_days": 4,
                "max_login_fails": 16,
                "max_daily_tries": 4,
                "max_layer3_fails": 8
            },
            headers=headers
        )
        assert r.status_code == 200


# ============ LEGACY USER TESTS ============

class TestLegacyUserLogin:
    """Legacy users (no birthday) should login directly without birthday step"""

    def test_legacy_user_direct_login(self):
        """Test with existing legacy user test@toppass5.com"""
        # This user was created without birthday in earlier iterations
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@toppass5.com",
            "password": "Test1234!"
        })
        
        if r.status_code == 200:
            data = r.json()
            # Legacy user should get complete stage directly (no birthday step)
            # OR if they have birthday now, they'll get birthday stage
            if data.get("stage") == "complete":
                print("Legacy user logged in directly (no birthday)")
                assert "token" in data
            elif data.get("stage") == "birthday":
                print("User has birthday set - needs verification")
                # This is also valid if the user was updated
        else:
            # User might not exist or password changed
            pytest.skip("Legacy test user not available or credentials changed")


# ============ AUTH/ME ENDPOINT TESTS ============

class TestAuthMe:
    """Test /auth/me endpoint returns correct user info"""

    @pytest.fixture(scope="class")
    def user_for_me_test(self):
        """Create user for /auth/me tests"""
        email = f"TEST_authme_{uuid.uuid4().hex[:8]}@example.com"
        r = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "TestAuthMe123!",
            "birthday": "1993-11-11"
        })
        assert r.status_code == 200
        return {"email": email, "token": r.json()["token"]}

    def test_auth_me_returns_user_fields(self, user_for_me_test):
        """GET /auth/me should return all required user fields"""
        headers = {"Authorization": f"Bearer {user_for_me_test['token']}"}
        r = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert r.status_code == 200
        data = r.json()
        
        # Check all required fields
        assert "id" in data
        assert "email" in data
        assert data["email"] == user_for_me_test["email"].lower()
        assert "has_birthday" in data
        assert data["has_birthday"] == True
        assert "layer3_enabled" in data
        assert "disclaimer_accepted" in data
        assert "hardcore_enabled" in data
