"""
TopPass5 VIP Phase 1 & 2 Backend Tests
Tests: Auth flow, duplicates, favorites, bulk actions, password history, tags, notes, L3 behavior
"""
import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://github-import-134.preview.emergentagent.com').rstrip('/')

# Test credentials from test_credentials.md
ADMIN_EMAIL = "admin@toppass5.com"
ADMIN_PASS = "TopPass5Owner!2024"
ADMIN_BIRTHDAY = "2000-01-01"

TEST_USER_EMAIL = "test@toppass5.com"
TEST_USER_PASS = "Test1234!"

class TestAuthFlow:
    """Test staged auth flow: email/password -> birthday -> vault"""
    
    def test_login_returns_birthday_stage(self):
        """Admin login should return stage='birthday' since birthday is set"""
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert r.status_code == 200, f"Login failed: {r.text}"
        data = r.json()
        # Admin has birthday set, so should require birthday verification
        assert data.get('stage') in ['birthday', 'complete'], f"Unexpected stage: {data}"
        if data.get('stage') == 'birthday':
            assert 'token' in data, "Stage token missing"
            print(f"SUCCESS: Login returns birthday stage with token")
        else:
            print(f"SUCCESS: Login completed (legacy user without birthday)")
    
    def test_birthday_verification_completes_login(self):
        """Verify birthday completes login for admin"""
        # Step 1: Login
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        assert r1.status_code == 200
        data1 = r1.json()
        
        if data1.get('stage') == 'birthday':
            stage_token = data1['token']
            # Step 2: Verify birthday
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday", 
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {stage_token}"}
            )
            assert r2.status_code == 200, f"Birthday verification failed: {r2.text}"
            data2 = r2.json()
            # Should complete or go to layer3
            assert data2.get('stage') in ['complete', 'layer3'], f"Unexpected stage after birthday: {data2}"
            print(f"SUCCESS: Birthday verification works, stage={data2.get('stage')}")
        else:
            print("INFO: Admin has no birthday set, skipping birthday verification test")
    
    def test_wrong_password_returns_error(self):
        """Wrong password should return 401 with readable error"""
        r = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "WrongPassword123!"
        })
        assert r.status_code == 401, f"Expected 401, got {r.status_code}"
        data = r.json()
        assert 'detail' in data, "Error detail missing"
        print(f"SUCCESS: Wrong password returns 401 with message: {data['detail']}")


class TestDuplicatesFeature:
    """Test duplicate password detection"""
    
    @pytest.fixture
    def auth_token(self):
        """Get full auth token for admin"""
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_duplicates_endpoint_returns_groups(self, auth_token):
        """Duplicates endpoint should return groups of items with same password"""
        r = requests.get(f"{BASE_URL}/api/items/duplicates",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert r.status_code == 200, f"Duplicates endpoint failed: {r.text}"
        data = r.json()
        assert 'groups' in data, "Missing 'groups' key"
        assert 'total_duplicates' in data, "Missing 'total_duplicates' key"
        print(f"SUCCESS: Duplicates endpoint returns groups={len(data['groups'])}, total={data['total_duplicates']}")
    
    def test_create_duplicate_items_detected(self, auth_token):
        """Creating two items with same password should be detected as duplicates"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        unique_pwd = f"DuplicateTest_{uuid.uuid4().hex[:8]}"
        
        # Create first item
        r1 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_Dup1_{uuid.uuid4().hex[:6]}",
            "value": unique_pwd,
            "category": "Secret"
        }, headers=headers)
        assert r1.status_code == 200, f"Create item 1 failed: {r1.text}"
        item1_id = r1.json()['id']
        
        # Create second item with SAME password
        r2 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_Dup2_{uuid.uuid4().hex[:6]}",
            "value": unique_pwd,
            "category": "Secret"
        }, headers=headers)
        assert r2.status_code == 200, f"Create item 2 failed: {r2.text}"
        item2_id = r2.json()['id']
        
        # Check duplicates
        r3 = requests.get(f"{BASE_URL}/api/items/duplicates", headers=headers)
        assert r3.status_code == 200
        data = r3.json()
        
        # Find our duplicate group
        found_group = None
        for group in data['groups']:
            ids_in_group = [item['id'] for item in group]
            if item1_id in ids_in_group and item2_id in ids_in_group:
                found_group = group
                break
        
        assert found_group is not None, f"Duplicate items not detected in groups: {data}"
        assert data['total_duplicates'] >= 2, f"total_duplicates should be >= 2, got {data['total_duplicates']}"
        print(f"SUCCESS: Duplicate items detected correctly, total_duplicates={data['total_duplicates']}")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item1_id}", headers=headers)
        requests.delete(f"{BASE_URL}/api/items/{item2_id}", headers=headers)


class TestFavoritesFeature:
    """Test favorite toggle functionality"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_toggle_favorite_on_item(self, auth_token):
        """Toggle favorite should update item and return new state"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create test item
        r1 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_Fav_{uuid.uuid4().hex[:6]}",
            "value": "TestPassword123!",
            "category": "Secret",
            "favorite": False
        }, headers=headers)
        assert r1.status_code == 200
        item_id = r1.json()['id']
        
        # Toggle favorite ON
        r2 = requests.patch(f"{BASE_URL}/api/items/{item_id}/favorite", headers=headers)
        assert r2.status_code == 200, f"Toggle favorite failed: {r2.text}"
        data2 = r2.json()
        assert data2['favorite'] == True, f"Expected favorite=True, got {data2}"
        print(f"SUCCESS: Favorite toggled ON")
        
        # Toggle favorite OFF
        r3 = requests.patch(f"{BASE_URL}/api/items/{item_id}/favorite", headers=headers)
        assert r3.status_code == 200
        data3 = r3.json()
        assert data3['favorite'] == False, f"Expected favorite=False, got {data3}"
        print(f"SUCCESS: Favorite toggled OFF")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)


class TestBulkActions:
    """Test bulk delete functionality"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_bulk_delete_multiple_items(self, auth_token):
        """Bulk delete should remove multiple items at once"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create 3 test items
        item_ids = []
        for i in range(3):
            r = requests.post(f"{BASE_URL}/api/items", json={
                "name": f"TEST_Bulk_{i}_{uuid.uuid4().hex[:6]}",
                "value": f"BulkTestPwd{i}!",
                "category": "Secret"
            }, headers=headers)
            assert r.status_code == 200
            item_ids.append(r.json()['id'])
        
        print(f"Created {len(item_ids)} items for bulk delete test")
        
        # Bulk delete
        r2 = requests.post(f"{BASE_URL}/api/items/bulk-action", json={
            "item_ids": item_ids,
            "action": "delete"
        }, headers=headers)
        assert r2.status_code == 200, f"Bulk delete failed: {r2.text}"
        data = r2.json()
        assert data.get('deleted') == 3, f"Expected 3 deleted, got {data}"
        print(f"SUCCESS: Bulk deleted {data['deleted']} items")
        
        # Verify items are gone
        for item_id in item_ids:
            r3 = requests.get(f"{BASE_URL}/api/items/{item_id}/value", headers=headers)
            assert r3.status_code == 404, f"Item {item_id} should be deleted"


class TestPasswordHistory:
    """Test password history tracking"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_password_history_recorded_on_update(self, auth_token):
        """Updating password should record history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create item with initial password
        initial_pwd = f"InitialPwd_{uuid.uuid4().hex[:6]}!"
        r1 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_History_{uuid.uuid4().hex[:6]}",
            "value": initial_pwd,
            "category": "Secret"
        }, headers=headers)
        assert r1.status_code == 200
        item = r1.json()
        item_id = item['id']
        
        # Update with new password
        new_pwd = f"NewPwd_{uuid.uuid4().hex[:6]}!"
        r2 = requests.put(f"{BASE_URL}/api/items/{item_id}", json={
            "name": item['name'],
            "value": new_pwd,
            "category": item['category'],
            "tags": [],
            "favorite": False,
            "notes": "",
            "custom_fields": []
        }, headers=headers)
        assert r2.status_code == 200, f"Update failed: {r2.text}"
        
        # Check history
        r3 = requests.get(f"{BASE_URL}/api/items/{item_id}/history", headers=headers)
        assert r3.status_code == 200, f"History endpoint failed: {r3.text}"
        history = r3.json()
        
        assert len(history) >= 1, f"Expected at least 1 history entry, got {len(history)}"
        # Most recent history entry should have the old password
        assert history[0]['value'] == initial_pwd, f"History value mismatch: expected {initial_pwd}, got {history[0]['value']}"
        print(f"SUCCESS: Password history recorded, {len(history)} entries found")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)
    
    def test_advance_mode_history_blocked(self, auth_token):
        """Advance mode items should not expose history"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # Create advance mode item
        r1 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_AdvHistory_{uuid.uuid4().hex[:6]}",
            "value": "AdvancePwd123!",
            "category": "Secret",
            "advance_mode": True,
            "advance_passphrase": "secret123"
        }, headers=headers)
        assert r1.status_code == 200
        item_id = r1.json()['id']
        
        # Try to get history - should be blocked
        r2 = requests.get(f"{BASE_URL}/api/items/{item_id}/history", headers=headers)
        assert r2.status_code == 403, f"Expected 403 for advance mode history, got {r2.status_code}"
        print(f"SUCCESS: Advance mode history correctly blocked with 403")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)


class TestTagsAndNotes:
    """Test tags and notes persistence"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_tags_persist_on_create(self, auth_token):
        """Tags should persist when creating item"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        tags = ["work", "important", "api"]
        
        r1 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_Tags_{uuid.uuid4().hex[:6]}",
            "value": "TagTestPwd123!",
            "category": "API key",
            "tags": tags
        }, headers=headers)
        assert r1.status_code == 200
        item = r1.json()
        item_id = item['id']
        
        assert item.get('tags') == tags, f"Tags not returned on create: {item}"
        print(f"SUCCESS: Tags persisted on create: {item['tags']}")
        
        # Verify via GET items
        r2 = requests.get(f"{BASE_URL}/api/items", headers=headers)
        items = r2.json()
        found = next((i for i in items if i['id'] == item_id), None)
        assert found is not None
        assert found.get('tags') == tags, f"Tags not persisted: {found}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)
    
    def test_notes_persist_on_create(self, auth_token):
        """Notes should persist when creating item"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        notes = "This is a test note with important information."
        
        r1 = requests.post(f"{BASE_URL}/api/items", json={
            "name": f"TEST_Notes_{uuid.uuid4().hex[:6]}",
            "value": "NotesTestPwd123!",
            "category": "Secret",
            "notes": notes
        }, headers=headers)
        assert r1.status_code == 200
        item = r1.json()
        item_id = item['id']
        
        assert item.get('notes') == notes, f"Notes not returned on create: {item}"
        print(f"SUCCESS: Notes persisted on create")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers)


class TestLoginHistory:
    """Test login history endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_login_history_returns_events(self, auth_token):
        """Login history should return recent login events"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        r = requests.get(f"{BASE_URL}/api/auth/login-history", headers=headers)
        assert r.status_code == 200, f"Login history failed: {r.text}"
        history = r.json()
        
        assert isinstance(history, list), f"Expected list, got {type(history)}"
        if len(history) > 0:
            event = history[0]
            assert 'id' in event, "Missing 'id' in login history event"
            assert 'ts' in event, "Missing 'ts' in login history event"
            assert 'device' in event, "Missing 'device' in login history event"
            # Should NOT have _id (MongoDB ObjectId)
            assert '_id' not in event, "MongoDB _id should be excluded"
            print(f"SUCCESS: Login history returns {len(history)} events with correct fields")
        else:
            print("INFO: No login history events yet")


class TestLayer3Behavior:
    """Test L3 password viewing behavior"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_l3_passwords_viewable_when_not_enabled(self, auth_token):
        """L3 passwords should be viewable freely when L3 is not enabled"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        # First check if L3 is enabled
        r = requests.get(f"{BASE_URL}/api/auth/layer3-passwords", headers=headers)
        
        if r.status_code == 200:
            data = r.json()
            assert 'passwords' in data, "Missing passwords in response"
            assert 'enabled' in data, "Missing enabled flag"
            if not data['enabled']:
                assert len(data['passwords']) == 20, f"Expected 20 passwords, got {len(data['passwords'])}"
                print(f"SUCCESS: L3 passwords viewable when not enabled, got {len(data['passwords'])} passwords")
            else:
                print("INFO: L3 is enabled, password viewing requires account password")
        elif r.status_code == 403:
            # L3 is enabled and requires password
            data = r.json()
            assert data.get('detail') == 'PASSWORD_REQUIRED', f"Unexpected 403 detail: {data}"
            print("SUCCESS: L3 enabled - correctly requires password to view")
        else:
            pytest.fail(f"Unexpected status {r.status_code}: {r.text}")
    
    def test_l3_export_always_available(self, auth_token):
        """L3 export should always work regardless of enabled state"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        r = requests.get(f"{BASE_URL}/api/auth/layer3-passwords?for_export=true", headers=headers)
        assert r.status_code == 200, f"L3 export failed: {r.text}"
        data = r.json()
        assert 'passwords' in data
        assert len(data['passwords']) == 20
        print(f"SUCCESS: L3 export works, got {len(data['passwords'])} passwords")


class TestAdminPanelSeparation:
    """Test admin panel is separate from user vault"""
    
    @pytest.fixture
    def auth_token(self):
        r1 = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASS
        })
        data1 = r1.json()
        if data1.get('stage') == 'birthday':
            r2 = requests.post(f"{BASE_URL}/api/auth/verify-birthday",
                json={"birthday": ADMIN_BIRTHDAY},
                headers={"Authorization": f"Bearer {data1['token']}"}
            )
            return r2.json().get('token')
        return data1.get('token')
    
    def test_admin_stats_endpoint_exists(self, auth_token):
        """Admin stats endpoint should work for admin user"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        
        r = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert r.status_code == 200, f"Admin stats failed: {r.text}"
        data = r.json()
        
        # Check expected fields
        assert 'total_users' in data
        assert 'total_items' in data
        assert 'adv_items' in data
        assert 'today_logins' in data
        print(f"SUCCESS: Admin stats endpoint works - {data['total_users']} users, {data['total_items']} items")
    
    def test_non_admin_blocked_from_admin_stats(self):
        """Non-admin user should be blocked from admin endpoints"""
        # Create a test user
        test_email = f"test_nonadmin_{uuid.uuid4().hex[:6]}@test.com"
        test_pwd = "TestPassword123!"
        test_bday = "1990-05-15"
        
        # Register
        r1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": test_pwd,
            "birthday": test_bday
        })
        if r1.status_code != 200:
            pytest.skip(f"Could not create test user: {r1.text}")
        
        token = r1.json()['token']
        headers = {"Authorization": f"Bearer {token}"}
        
        # Try admin endpoint
        r2 = requests.get(f"{BASE_URL}/api/admin/stats", headers=headers)
        assert r2.status_code == 403, f"Expected 403 for non-admin, got {r2.status_code}"
        print(f"SUCCESS: Non-admin correctly blocked from admin stats with 403")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
