# TopPass5 Secure Vault — PRD

## Original Problem Statement
1. Import app from GitHub: `https://github.com/tragethunterind91-debug/app`
2. Follow-up: User asked about replacing MongoDB with Neon / Firebase / Supabase because they thought MongoDB would "drink all money" when the app goes public, and wanted Firebase for hosting/auth.

## Decision Made (2026-02)
- **Kept MongoDB**: It is free on Emergent even in production. Migration would be a destructive full-backend rewrite with zero benefit.
- **Rejected Firebase Auth**: The app is a password vault with a deliberate 3-layer authentication system (password → birthday → quiz) plus Hardcore Mode auto-delete. Adding Google Sign-In would bypass all 3 security layers and defeat the vault's purpose.
- **No database migration performed.** App remains on MongoDB (Motor async driver).

## Architecture
- **Frontend**: React (CRA) at `/app/frontend`
- **Backend**: FastAPI at `/app/backend/server.py` (single file)
- **DB**: MongoDB via Motor
- **Crypto**: AES-256 (Cryptography/Fernet) for vault items, JWT for sessions
- **Auth flow**: 3-layer (Password → Birthday → Layer 3 quiz answer)

## Features (all already implemented)
- Multi-layer authentication with Hardcore Mode (account auto-delete after N fails)
- AES-256 encrypted password vault
- Password Generator (Random + Passphrase modes, length 8-64, character options)
- Import / Export as JSON
- Bulk selection & delete
- Tags, Favorites, Categories, Duplicate detection
- TOTP support per item
- Breach check
- Advance Mode (per-item passphrase lock)
- Share via expiring links
- Password history
- Dark / Light theme toggle (settings.theme)
- Login history & device tracking
- Admin panel

## Test Credentials
See `/app/memory/test_credentials.md`.

## Backlog / Future
- None specifically requested — app is feature-complete for a password manager MVP.
- Potential enhancements (user-driven): CSV import from Chrome/LastPass, 2FA via authenticator, cloud backup, browser extension.

## Health
- Backend `/api/` → `{"message":"CryptonVault API"}` — OK
- Frontend serving TOPPASS5 loading screen — OK
- Supervisor: backend, frontend, mongodb all RUNNING
