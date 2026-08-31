# TopPass5 — Product Requirements Document

## Original Problem Statement
A website for saving passwords/values with tight security (TopPass5). Users can store, add, edit, delete, copy, search, and export/import values.

## App Architecture
- Frontend: React (Hooks), Tailwind CSS, Pure CSS Animations, Lucide-react icons, Sonner toasts
- Backend: FastAPI, Motor (MongoDB Async)
- Auth: JWT (joserfc), Google OAuth (authlib)
- Encryption: AES (cryptography.fernet) for vault items

## File Structure
```
/app/
├── backend/
│   ├── server.py (FastAPI, Auth, Encryption, API logic — ~290 lines)
│   └── .env (Keys, DB mapping, VAULT_KEY, ADMIN_EMAIL, ADMIN_PASS)
├── frontend/
│   ├── src/
│   │   ├── App.js (React components — ~90 lines compact)
│   │   ├── AdminPanel.js (Owner dashboard)
│   │   ├── App.css (Styling)
│   │   ├── brand.css (Mobile responsive + branding overrides)
│   │   └── index.js
│   └── public/
│       └── index.html, toppass5-logo-sm.jpeg
```

## Key DB Schema
- users: {id, email, hashed_password, google_id, phrase_hash, name, created_at}
- items: {id, user_id, name, secret (AES), category, totp_enc, url, advance_mode, advance_hash, created_at, updated_at}
- shares: {token, item_id, user_id, expires}
- audit: {user_id, action, detail, ts}
- preferences: {user_id, categories}
- recovery_requests: {email, user_id_hint, app_name, description, status, created_at}

## Key API Endpoints
- POST /api/auth/register → returns {token, user, phrase (12 words)}
- POST /api/auth/login
- POST /api/auth/phrase-login → {email, phrase} → {token, user}
- POST /api/auth/phrase-reset → {email, phrase, new_password}
- POST /api/auth/set-phrase (auth) → {phrase}
- GET /api/items
- POST /api/items
- PUT /api/items/{id}
- DELETE /api/items/{id}
- GET /api/items/{id}/value
- POST /api/items/{id}/advance-reveal → {passphrase}
- GET /api/items/{id}/totp
- POST /api/items/import
- GET /api/shares
- POST /api/items/{id}/share → {hours}
- DELETE /api/shares/{token}
- GET /api/share/{token} (public)
- GET /api/security/report
- GET /api/audit
- GET/PUT /api/preferences
- POST /api/recovery-request
- GET /api/admin/stats (admin only)
- PATCH /api/admin/recovery/{id} (admin only)

## Features Implemented ✅
- Email + Password auth with registration/login
- Google OAuth login
- JWT-based sessions (12h expiry)
- AES vault encryption (Fernet)
- CRUD: Add, Edit, Delete, Reveal, Copy vault items
- Search and Category filter
- Password Generator
- Import/Export (JSON)
- TOTP storage + code generation
- Secure Share links with expiry picker (1h/12h/24h/7d)
- Share Revoke (My Shares modal)
- Breach Monitoring (background check on login + per-item recheck button)
- Security Report (weak/reused/old passwords, score/100)
- Audit Log (activity history)
- Advance Mode (item-level extra passphrase lock; disables share/download)
- URL tag per item (ExternalLink icon in item row)
- TopPass5 Logo + ZNQ NETWORK loading screen (pure CSS)
- **Layer 3 Crypto-Wallet Recovery Phrase** (12-word phrase generated on register, login/reset via phrase, existing users can generate via sidebar)
- Admin Panel (owner stats: users, items, logins; recovery request management)

## Pending / Future Work
- P0 (Upcoming): Layer 2 — Mobile/WhatsApp/Telegram OTP (needs Twilio or Telegram Bot integration)
- P1 (Admin Panel): Ads tracking counter, members-online-today stat
- P2 (Refactor): Break bloated App.js (~90 lines) into smaller component files
- P2 (Enhancement): Suggest adding email-based password reset (magic link)

## Budget Note
User constraint: max 20 credits per 100 available. Maximize parallel tool calls, avoid loops.
