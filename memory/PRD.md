# TopPass5 — Product Requirements Document

## Original Problem Statement
A website for saving passwords/values with tight security (TopPass5). Users can store, add, edit, delete, copy, search, and export/import values.

## App Architecture
- Frontend: React (Hooks), Lucide-react icons, Sonner toasts, Pure CSS
- Backend: FastAPI, Motor (MongoDB Async)
- Auth: JWT (joserfc), Google OAuth (authlib)
- Encryption: AES (cryptography.fernet) for vault items

## File Structure
```
/app/
├── backend/
│   ├── server.py (~295 lines)
│   └── .env (VAULT_KEY, SESSION_SECRET, MONGO_URL, DB_NAME, ADMIN_EMAIL, ADMIN_PASS)
├── frontend/
│   ├── src/
│   │   ├── App.js (~210 lines)
│   │   ├── AdminPanel.js
│   │   ├── App.css + brand.css
│   │   └── index.js
│   └── public/toppass5-logo-sm.jpeg
```

## Key API Endpoints
- POST /api/auth/register → {token, user, phrase(12 words)}
- POST /api/auth/login
- POST /api/auth/recovery → {reset_code} (1h expiry, upsert)
- POST /api/auth/reset-password → {token, new_password}
- POST /api/auth/phrase-login → {email, phrase}
- POST /api/auth/phrase-reset → {email, phrase, new_password}
- POST /api/auth/set-phrase (auth) → {phrase}
- GET/POST/PUT/DELETE /api/items, /api/items/{id}/value
- POST /api/items/{id}/advance-reveal → {passphrase}
- GET /api/items/{id}/totp
- POST /api/items/import
- GET/POST /api/shares, DELETE /api/shares/{token}
- GET /api/share/{token} (public)
- GET /api/security/report
- GET /api/audit
- GET/PUT /api/preferences (autofill, categories)
- GET/PATCH /api/admin/*

## Features Implemented ✅
- Email + Password auth + Google OAuth
- JWT sessions (12h)
- AES vault encryption (Fernet)
- CRUD vault items (add/edit/delete/reveal/copy)
- Search + Category filter
- Password Generator (8-64 chars, charset controls)
- Import/Export JSON
- TOTP storage + code generation (client-side HMAC)
- Secure Share links (1h/12h/24h/7d expiry)
- Share Revoke (My Shares modal)
- Breach Monitoring (background scan on login + per-item + re-check all)
- **Persistent Breach Badge** (red count or green ✓ on Security Report nav)
- Security Report (score/100, weak/reused/old)
- Audit Log
- Advance Mode (extra passphrase; disables share/download; no recovery)
- URL tag per item
- TopPass5 Logo + ZNQ NETWORK loading screen (pure CSS)
- **Layer 3 Crypto-Wallet Recovery Phrase** (12-word no-duplicate, login/reset via phrase)
- **Phrase Copy Button** (Copy All Words in both phrase modals)
- **Forgot Password / Email Reset** (generates reset link, /?reset=TOKEN shows ResetView)
- **Settings modal** (Browser Autofill toggle, saved to preferences)
- **Help & Guide modal** (comprehensive feature guide, detailed Advance Mode explanation)
- Admin Panel (owner stats, recovery request management)

## Pending / Future Work
- P0: Layer 2 — Mobile OTP (ON HOLD — user deferred)
- P1: Admin Panel — real ads/online tracking stats
- P1: Real email delivery (Resend/SendGrid) for reset links
- P2: Refactor App.js into smaller component files
