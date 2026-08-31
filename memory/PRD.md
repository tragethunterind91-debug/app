# TopPass5 — Product Requirements

## Original Problem Statement
Make a website for saving passwords/values with names under very tight security. Requires a backend. Login via Google and email+password. Users can store, add, edit, delete, copy, search, and export/import values. Remove existing sharing feature. Add password generator. Keep recovery/audit logs for later.

## Architecture
- React frontend (SPA) + FastAPI backend + MongoDB (Motor async driver)
- JWT sessions (12h expiry) for email/password auth; Google OAuth via authlib
- Vault values encrypted with Fernet (AES-128-CBC) before MongoDB storage
- List responses never include plaintext — reveal is a separate authenticated endpoint
- Frontend calls REACT_APP_BACKEND_URL; backend reads MONGO_URL + DB_NAME from .env

## User Personas
- Individuals keeping passwords, API keys, secure notes, Wi-Fi credentials

## Core Requirements (static)
- Secure registration/login + Google OAuth
- Add, Reveal, Copy, Edit, Delete named vault values
- Search vault items by name
- Password Generator (client-side, configurable length & character sets)
- Export all vault items as decrypted JSON backup (with confirm dialog)
- Import from backup JSON (bulk re-encrypt & store)
- No sharing feature (removed)
- Recovery pending (deferred by user)
- Audit logs pending (deferred by user)

## Implemented (2026-08-30)
- Email/password registration + login, Google OAuth redirect/callback, JWT-protected API
- Encrypted vault CRUD: Create, Reveal, Edit (PUT), Delete
- Search bar filtering items by name (client-side useMemo)
- Password Generator modal (length slider 8–64, uppercase/lowercase/numbers/symbols toggles, regenerate + copy)
- Inline "Generate" button inside Add/Edit item form value field
- Import: file picker → parse JSON → POST /api/items/import (bulk re-encrypt)
- Export All: confirm dialog → decrypt all → download toppass5-backup.json
- Export Individual: per-item JSON download
- Removed: POST /api/items/{id}/share and GET /api/shares/{token} endpoints
- Responsive TopPass5 UI — mobile bottom bar with logout, search, item list
- Full data-testid coverage on all interactive and user-facing elements
- App logo: geometric neon-blue shield (toppass5-logo-sm.jpeg, 6KB) in /public
- Loading screen: dark splash with TOPPASS5 text reveal animation, neon sweep bar, "SECURING YOUR VAULT" cursor effect, ZNQ NETWORK logo at bottom
- Brand marks updated in sidebar and auth page header with the app logo
- **Category filter chips**: All | Login | API key | Secret | Secure note — filters item list client-side
- **Audit log**: Activity nav in sidebar → modal table of last 50 events (LOGIN, CREATE, REVEAL, SHARE, DELETE) tracked per-user in MongoDB
- **Secure Share**: Share button per item generates a 24h token link → anyone with link sees decrypted value on a clean ShareView public page
- **ShareView**: Public page (?share=TOKEN) decrypts and shows value with copy button, no auth required
- Brand logo (ZNQ NETWORK) shown on loading screen

## Key API Endpoints
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/google → /api/auth/google/callback
- GET /api/auth/me
- GET /api/items (list, no secrets)
- POST /api/items (create + encrypt)
- GET /api/items/{id}/value (decrypt + return)
- PUT /api/items/{id} (edit + re-encrypt)
- DELETE /api/items/{id}
- POST /api/items/import (bulk create + encrypt)
- POST /api/auth/recovery (stub, returns code)

## DB Schema
- users: {id, email, password(hashed), name, google(bool), created_at}
- items: {id, user_id, name, category, secret(encrypted), created_at, updated_at}
- recovery: {code, user_id, expires}

## Prioritized Backlog
- P1: Auto-fill / browser extension (website URL tag per item)
- P2: Recovery email delivery (currently stub — returns code in response)
- P2: Emergency access / trusted contact
- P2: Passkey support (WebAuthn)
- P2: Encrypted export format option

## Key API Endpoints (updated)
- POST /api/items/import, GET /api/audit
- POST /api/items/{id}/share, GET /api/share/{token}
- GET /api/items/{id}/totp
- GET /api/security/report
- GET/PUT /api/preferences

## Test Credentials
- Email: test@toppass5.com / Password: Test1234!
