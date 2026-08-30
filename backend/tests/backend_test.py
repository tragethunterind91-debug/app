import os
import uuid
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")


def test_auth_and_item_lifecycle():
    email = f"TEST_{uuid.uuid4().hex}@example.com"
    password = "SecurePass123!"
    s = requests.Session()
    reg = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 200
    body = reg.json()
    assert body["user"]["email"] == email.lower()
    token = body["token"]
    headers = {"Authorization": f"Bearer {token}"}

    assert s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": password}).status_code == 200
    assert s.post(f"{BASE_URL}/api/auth/login", json={"email": email, "password": "WrongPass123!"}).status_code == 401
    assert s.get(f"{BASE_URL}/api/auth/me", headers=headers).json()["email"] == email.lower()
    assert s.get(f"{BASE_URL}/api/items", headers=headers).json() == []

    created = s.post(f"{BASE_URL}/api/items", headers=headers, json={"name": "TEST WiFi", "value": "secret-value", "category": "Login"})
    assert created.status_code == 200
    item = created.json()
    assert item["name"] == "TEST WiFi" and "value" not in item and "secret" not in item and "_id" not in item
    item_id = item["id"]
    listed = s.get(f"{BASE_URL}/api/items", headers=headers).json()
    assert len(listed) == 1 and "secret-value" not in str(listed)
    assert s.get(f"{BASE_URL}/api/items/{item_id}/value", headers=headers).json()["value"] == "secret-value"

    updated = s.put(f"{BASE_URL}/api/items/{item_id}", headers=headers, json={"name": "TEST Updated", "value": "new-secret", "category": "Secret"})
    assert updated.status_code == 200 and updated.json()["name"] == "TEST Updated"
    assert s.get(f"{BASE_URL}/api/items/{item_id}/value", headers=headers).json()["value"] == "new-secret"

    # Sharing feature removed — verify 404
    share = s.post(f"{BASE_URL}/api/items/{item_id}/share", headers=headers, json={"expires_hours": 1})
    assert share.status_code == 404, f"Sharing should be removed but got {share.status_code}"
    recovery = s.post(f"{BASE_URL}/api/auth/recovery", json={"email": email})
    assert recovery.status_code == 200 and recovery.json().get("recovery_code")

    assert s.delete(f"{BASE_URL}/api/items/{item_id}", headers=headers).status_code == 200
    assert s.get(f"{BASE_URL}/api/items/{item_id}/value", headers=headers).status_code == 404


def test_import_items():
    email = f"TEST_import_{uuid.uuid4().hex[:8]}@example.com"
    s = requests.Session()
    reg = s.post(f"{BASE_URL}/api/auth/register", json={"email": email, "password": "SecurePass123!"})
    token = reg.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"items": [{"name": "TEST Imported", "value": "imp-secret", "category": "Secret"}]}
    r = s.post(f"{BASE_URL}/api/items/import", headers=headers, json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["count"] == 1
    assert data["items"][0]["name"] == "TEST Imported"


def test_protected_routes_reject_missing_auth():
    response = requests.get(f"{BASE_URL}/api/items")
    assert response.status_code == 401