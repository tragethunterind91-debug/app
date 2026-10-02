# TopPass5 — Encrypted Secrets Vault

## Original problem statement
Import and run the existing TopPass5 (GitHub `tragethunterind91-debug/app`, branch `conflict_300926_0642`) with parity to the non-main branch. Google OAuth skipped. Keep existing JWT authentication. Fresh VAULT_KEY acceptable (empty vault). Run as-is, no security hardening in the import pass.

Stack: FastAPI + MongoDB + React (CRA/craco).

## Current state (Feb 2026)
- App is imported into `/app` from branch `conflict_300926_0642` and runs on supervisor-managed backend/frontend.
- Fresh backend secrets are set in `/app/backend/.env` (SESSION_SECRET, VAULT_KEY, ADMIN_EMAIL/PASS/BIRTHDAY). Values are never echoed in responses.
- End-to-end smoke tested: register → login (birthday stage) → create/update/delete item → reveal → import → share → logout.

## Security hardening completed (this pass)
After the user requested a bug/error/security report, the following fixes were implemented and backend-verified via curl:

1. **VAULT_KEY: fail-fast + HKDF-SHA256 derivation.** Backend refuses to start without a ≥32-char `VAULT_KEY`. Prevents silent vault wipes on restart and raw-env-as-key use.
2. **CORS: no wildcard + credentials combination.** `.env` pinned to the preview origin. If `*` is ever reintroduced, credentials are automatically disabled.
3. **Removed `?token=` URL login injection** in the SPA bootstrap.
4. **JWT moved out of localStorage to httpOnly `SameSite=Strict` cookie.** New middleware promotes the cookie to `Authorization` for existing handlers. Added `POST /api/auth/logout` that clears the cookie. Axios uses `withCredentials: true`.
5. **`/auth/login-status` user-enumeration fix.** Endpoint returns a constant `{hardcore:false, layer3_enabled:false}` with rate limiting; per-user state is only on `/auth/me`.
6. **Rate limiting via slowapi** on `/auth/login`, `/auth/register`, `/auth/verify-birthday`, `/auth/verify-layer3`, `/auth/recovery`, `/auth/reset-password`, `/auth/login-status`, `/emergency/request`.
7. **`/items/import` now preserves all fields** including `advance_mode`, `advance_passphrase`, `totp_secret`, `url`, `tags`, `notes`, `favorite`, `custom_fields`. Imports without an advance passphrase for an advance_mode item are skipped rather than stored unprotected.
8. **Hardcore settings now require account password.** `HardcoreSettings` model has a `password` field; PUT verifies with `pwd.verify` before applying — prevents session-token-holding attackers from toggling vault auto-delete.
9. **`l3_viewed` one-shot lock removed.** Viewing is gated by account password when Layer 3 is enabled (same as before); no silent, non-recoverable self-lock.
10. **Mass-decrypt endpoints replaced with pre-computed-fingerprint logic.** Items now store `value_fingerprint` (SHA-256) and `value_length` at create/update. `/items/duplicates` and `/security/report` group/scan via these fields; legacy items are backfilled lazily on first access. Decryption is no longer required to compute the full-vault views.
11. **passlib ↔ bcrypt warning fixed.** Pinned `bcrypt==4.0.1` which exposes `__about__.__version__` to passlib 1.7.4.

## Items NOT addressed in this pass (explicit user scope)
- Password-reset returning `reset_code` in the response (critical — still open)
- Emergency-access returning `access_token` in the response (critical — still open)
- JWT revocation list / shorter TTL
- CSRF double-submit token (SameSite=Strict + same-origin API currently covers it)
- `/items/{id}/history` design review
- Admin seed password strength / rotation
- `log_event` swallowing errors silently
- `request.client.host` inaccurate behind ingress
- Rate limits do not consider auth stages beyond IP keying
- Weak passphrase check for Advance Mode

## File map
- Backend: `/app/backend/server.py`, `.env`, `requirements.txt`
- Frontend: `/app/frontend/src/App.js`, `VaultItems.js`, `NewFeatures.js`, `SettingsPanel.js`, `LandingPage.js`, `AdminPanel.js`, `LoadingScreen.js`
- Memory: `/app/memory/test_credentials.md`, `/app/memory/PRD.md`

## Backlog
- P0: Address password-reset and emergency-access token leaks (require email delivery; return opaque success message only).
- P1: Add formal pytest coverage under `/app/backend/tests/` (currently empty).
- P1: Add CSP + XSS hardening pass for the SPA.
- P2: UI redesign of the hardcore confirmation flow with explicit "type the word DELETE" guard.
- P2: Owner-side notifications for emergency-access requests.
