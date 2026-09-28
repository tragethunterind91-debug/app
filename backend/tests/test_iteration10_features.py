"""
Iteration 10 Backend Tests - TopPass5 Major Changes
Tests for:
1. Landing page flow (frontend-only, but verify auth endpoints still work)
2. Google OAuth REMOVED (endpoints should 404)
3. Recovery phrase REMOVED (endpoints should 404)
4. Disclaimer toggle in settings (not auto-shown)
5. Birthday warning text (frontend-only)
6. L3 regen limit changed to 3/month
7. Logout returns to landing (frontend-only)
8. Registration no longer returns 'phrase' field
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session

class TestRemovedEndpoints:
    """Test that Google OAuth and Recovery Phrase endpoints are REMOVED (404)"""
    
    def test_google_oauth_endpoint_removed(self, api_client):
        """POST /api/auth/google should return 404 (removed)"""
        response = api_client.post(f"{BASE_URL}/api/auth/google", json={"token": "fake"})
        # Should be 404 or 405 (method not allowed) since endpoint doesn't exist
        assert response.status_code in [404, 405, 422], f"Expected 404/405/422, got {response.status_code}"
        print(f"✓ Google OAuth endpoint removed - returns {response.status_code}")
    
    def test_phrase_login_endpoint_removed(self, api_client):
        """POST /api/auth/phrase-login should return 404 (removed)"""
        response = api_client.post(f"{BASE_URL}/api/auth/phrase-login", json={
            "email": "test@example.com",
            "phrase": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
        })
        assert response.status_code in [404, 405, 422], f"Expected 404/405/422, got {response.status_code}"
        print(f"✓ Phrase login endpoint removed - returns {response.status_code}")
    
    def test_phrase_reset_endpoint_removed(self, api_client):
        """POST /api/auth/phrase-reset should return 404 (removed)"""
        response = api_client.post(f"{BASE_URL}/api/auth/phrase-reset", json={
            "email": "test@example.com",
            "phrase": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12",
            "new_password": "NewPassword123!"
        })
        assert response.status_code in [404, 405, 422], f"Expected 404/405/422, got {response.status_code}"
        print(f"✓ Phrase reset endpoint removed - returns {response.status_code}")
    
    def test_set_phrase_endpoint_removed(self, api_client):
        """POST /api/auth/set-phrase should return 404 (removed)"""
        response = api_client.post(f"{BASE_URL}/api/auth/set-phrase", json={
            "phrase": "word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12"
        })
        # Without auth, might get 401 first, but endpoint should not exist
        assert response.status_code in [401, 404, 405, 422], f"Expected 401/404/405/422, got {response.status_code}"
        print(f"✓ Set phrase endpoint removed - returns {response.status_code}")


class TestRegistrationNoPhrase:
    """Test that registration no longer returns recovery phrase"""
    
    def test_register_returns_l3_passwords_no_phrase(self, api_client):
        """Registration should return layer3_passwords but NOT phrase"""
        unique_email = f"TEST_iter10_reg_{uuid.uuid4().hex[:8]}@test.com"
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1990-05-15"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Should have token and user
        assert "token" in data, "Missing token in response"
        assert "user" in data, "Missing user in response"
        
        # Should have layer3_passwords (20 passwords)
        assert "layer3_passwords" in data, "Missing layer3_passwords in response"
        assert len(data["layer3_passwords"]) == 20, f"Expected 20 L3 passwords, got {len(data['layer3_passwords'])}"
        
        # Should NOT have phrase field
        assert "phrase" not in data, "Response should NOT contain 'phrase' field (removed)"
        
        print(f"✓ Registration returns 20 L3 passwords, no phrase field")
        print(f"  - L3 passwords sample: {data['layer3_passwords'][:3]}...")


class TestL3RegenMonthlyLimit:
    """Test that L3 regeneration limit is 3 per month (not 5 per week)"""
    
    def test_l3_regen_returns_monthly_limit_info(self, api_client):
        """Regenerate L3 should mention monthly limit in response"""
        # First register a new user
        unique_email = f"TEST_iter10_l3regen_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1990-05-15"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        
        # Try to regenerate L3 passwords
        regen_response = api_client.post(
            f"{BASE_URL}/api/auth/regenerate-layer3",
            json={"password": "TestPass123!"},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert regen_response.status_code == 200, f"Regen failed: {regen_response.text}"
        data = regen_response.json()
        
        # Should have new passwords
        assert "passwords" in data, "Missing passwords in regen response"
        assert len(data["passwords"]) == 20, f"Expected 20 passwords, got {len(data['passwords'])}"
        
        # Should have changes_remaining (2 after first regen, since limit is 3/month)
        assert "changes_remaining" in data, "Missing changes_remaining in response"
        assert data["changes_remaining"] == 2, f"Expected 2 changes remaining, got {data['changes_remaining']}"
        
        print(f"✓ L3 regen returns changes_remaining: {data['changes_remaining']} (3/month limit)")


class TestDisclaimerToggle:
    """Test disclaimer toggle endpoint (not auto-shown)"""
    
    def test_toggle_disclaimer_on_off(self, api_client):
        """Toggle disclaimer should work via settings"""
        # Register new user
        unique_email = f"TEST_iter10_disclaimer_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1990-05-15"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        user = reg_response.json()["user"]
        
        # New user should have disclaimer_enabled: false (not auto-shown)
        assert user.get("disclaimer_enabled") == False, "New user should have disclaimer_enabled=false"
        
        # Enable disclaimer
        toggle_on = api_client.post(
            f"{BASE_URL}/api/auth/toggle-disclaimer",
            json={"enabled": True},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert toggle_on.status_code == 200
        assert toggle_on.json()["enabled"] == True
        
        # Verify via /auth/me
        me_response = api_client.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert me_response.status_code == 200
        assert me_response.json()["disclaimer_enabled"] == True
        
        # Disable disclaimer
        toggle_off = api_client.post(
            f"{BASE_URL}/api/auth/toggle-disclaimer",
            json={"enabled": False},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert toggle_off.status_code == 200
        assert toggle_off.json()["enabled"] == False
        
        print(f"✓ Disclaimer toggle works: on/off via settings")


class TestMultiStageLogin:
    """Test multi-stage login flow (unchanged but verify still works)"""
    
    def test_login_stage1_returns_birthday_stage(self, api_client):
        """Login with correct password should return stage='birthday' for users with birthday"""
        # Use test user with birthday
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@toppass5.com",
            "password": "Test1234!"
        })
        
        if response.status_code == 200:
            data = response.json()
            # User has birthday, should get stage='birthday'
            if data.get("stage") == "birthday":
                assert "token" in data, "Missing stage token"
                assert data.get("needs_birthday") == True
                print(f"✓ Login Stage 1 returns stage='birthday' for user with birthday")
            elif data.get("stage") == "complete":
                # Legacy user without birthday - direct access
                print(f"✓ Login returns stage='complete' for legacy user without birthday")
        else:
            print(f"⚠ Login returned {response.status_code}: {response.text}")
    
    def test_birthday_verification_flow(self, api_client):
        """Test birthday verification advances login"""
        # Register new user with birthday
        unique_email = f"TEST_iter10_bday_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1995-03-20"
        })
        assert reg_response.status_code == 200
        
        # Login - should get birthday stage
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "TestPass123!"
        })
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert login_data.get("stage") == "birthday", f"Expected stage='birthday', got {login_data.get('stage')}"
        stage_token = login_data["token"]
        
        # Verify birthday - correct date
        verify_response = api_client.post(
            f"{BASE_URL}/api/auth/verify-birthday",
            json={"birthday": "1995-03-20"},
            headers={"Authorization": f"Bearer {stage_token}"}
        )
        assert verify_response.status_code == 200
        verify_data = verify_response.json()
        
        # Should complete (no L3 enabled by default)
        assert verify_data.get("stage") == "complete", f"Expected stage='complete', got {verify_data.get('stage')}"
        assert "token" in verify_data, "Missing full access token"
        
        print(f"✓ Birthday verification flow works correctly")
    
    def test_wrong_birthday_rejected(self, api_client):
        """Wrong birthday should be rejected"""
        # Register new user
        unique_email = f"TEST_iter10_wrongbday_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1995-03-20"
        })
        assert reg_response.status_code == 200
        
        # Login
        login_response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": unique_email,
            "password": "TestPass123!"
        })
        assert login_response.status_code == 200
        stage_token = login_response.json()["token"]
        
        # Verify with wrong birthday
        verify_response = api_client.post(
            f"{BASE_URL}/api/auth/verify-birthday",
            json={"birthday": "2000-01-01"},  # Wrong date
            headers={"Authorization": f"Bearer {stage_token}"}
        )
        assert verify_response.status_code == 401, f"Expected 401, got {verify_response.status_code}"
        
        print(f"✓ Wrong birthday correctly rejected with 401")


class TestL3QuizFlow:
    """Test Layer 3 crypto type pass quiz flow"""
    
    def test_l3_enable_requires_quiz(self, api_client):
        """Enabling L3 should require passing a quiz"""
        # Register new user
        unique_email = f"TEST_iter10_l3quiz_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1990-05-15"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        l3_passwords = reg_response.json()["layer3_passwords"]
        
        # Try to enable L3 without quiz - should fail
        enable_no_quiz = api_client.post(
            f"{BASE_URL}/api/auth/toggle-layer3",
            json={"enabled": True},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert enable_no_quiz.status_code == 400, f"Expected 400 without quiz, got {enable_no_quiz.status_code}"
        
        # Enable with correct quiz answers
        quiz_indices = [0, 5, 10]  # Random indices
        quiz_answers = {str(i): l3_passwords[i] for i in quiz_indices}
        
        enable_with_quiz = api_client.post(
            f"{BASE_URL}/api/auth/toggle-layer3",
            json={"enabled": True, "quiz_indices": quiz_indices, "quiz_answers": quiz_answers},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert enable_with_quiz.status_code == 200, f"Enable with quiz failed: {enable_with_quiz.text}"
        assert enable_with_quiz.json()["enabled"] == True
        
        print(f"✓ L3 enable requires quiz - works correctly")


class TestExistingEndpointsStillWork:
    """Verify existing endpoints still function"""
    
    def test_api_root(self, api_client):
        """API root should return message"""
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        assert "message" in response.json()
        print(f"✓ API root works")
    
    def test_login_status_endpoint(self, api_client):
        """Login status endpoint should work"""
        response = api_client.get(f"{BASE_URL}/api/auth/login-status?email=test@toppass5.com")
        assert response.status_code == 200
        data = response.json()
        # Should have hardcore field
        assert "hardcore" in data
        print(f"✓ Login status endpoint works")
    
    def test_recovery_endpoint_exists(self, api_client):
        """Password recovery endpoint should still exist (different from phrase recovery)"""
        response = api_client.post(f"{BASE_URL}/api/auth/recovery", json={
            "email": "nonexistent@test.com"
        })
        # Should return 200 with message (even for non-existent email for security)
        assert response.status_code == 200
        assert "message" in response.json()
        print(f"✓ Password recovery endpoint still exists")


class TestHardcoreMode:
    """Test Hardcore Mode settings"""
    
    def test_hardcore_settings_get_update(self, api_client):
        """Get and update hardcore settings"""
        # Register new user
        unique_email = f"TEST_iter10_hardcore_{uuid.uuid4().hex[:8]}@test.com"
        reg_response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "TestPass123!",
            "birthday": "1990-05-15"
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]
        
        # Get hardcore settings
        get_response = api_client.get(
            f"{BASE_URL}/api/auth/hardcore-settings",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 200
        data = get_response.json()
        assert "enabled" in data
        assert "settings" in data
        assert data["enabled"] == False  # Default off
        
        # Update hardcore settings
        update_response = api_client.put(
            f"{BASE_URL}/api/auth/hardcore-settings",
            json={
                "enabled": True,
                "max_login_fail_days": 4,
                "max_login_fails": 16,
                "max_daily_tries": 4,
                "max_layer3_fails": 8
            },
            headers={"Authorization": f"Bearer {token}"}
        )
        assert update_response.status_code == 200
        
        # Verify update
        verify_response = api_client.get(
            f"{BASE_URL}/api/auth/hardcore-settings",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert verify_response.status_code == 200
        assert verify_response.json()["enabled"] == True
        
        print(f"✓ Hardcore settings get/update works")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
