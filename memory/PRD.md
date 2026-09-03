# TopPass5 — Secure Vault PRD

## Original Problem Statement
Build a website for saving passwords/values with tight security (TopPass5). Users can store, add, edit, delete, copy, search, and export/import values.

## User Flow
1. User opens site → 6-second loading screen (shield, TOPPASS5, security badges, ZNQ branding)
2. Landing page with hero, 6 feature cards, security badges, "Get Started" button
3. Auth screen (login or register) — NO Google login, NO recovery phrase
4. Multi-stage login: Email/Password → Birthday verification → Crypto Type Pass quiz (if enabled)
5. Vault dashboard with all CRUD, settings, security features

## Multi-Layer Authentication
- **Layer 1**: Email/Password
- **Layer 2**: Birthday verification (double-confirm on register, verify on login). NO forgot birthday. Legacy users add from Settings (one-time).
- **Layer 3 (Crypto Type Pass)**: 20 passwords (5 random chars each). Quiz on 3 random positions. Toggle on/off (passwords persist). Quiz required to enable. Max 3 regenerations/month.
- **Hardcore Mode**: Auto-delete on configurable failure limits. Login screen shows remaining attempts.

## Settings Menu
- Browser Autofill, Vault PIN Lock
- Layer 2 — Birthday: Set/view status
- Layer 3 — Crypto Type Pass: Toggle, View, Export, Regenerate (3/month)
- Security — Disclaimer toggle (user enables, not auto-shown)
- Hardcore Mode: Enable/disable, custom limits
- Terms & Conditions, Privacy Policy, Log Out

## Removed Features
- Google OAuth login (removed per user request)
- Recovery phrase (removed — security risk if hacker gets it)
- Forgot password mechanism for L1 and L2

## What's Been Implemented
- Landing page with hero, features, security messaging
- 6-second enhanced loading screen (14s animated)
- Multi-layer auth (L1, L2 birthday, L3 crypto type pass)
- AES-encrypted vault CRUD, password generator, import/export
- Search & categories, TOTP, security dashboard, advance mode
- Vault PIN Lock, Admin Panel
- Hardcore Mode with customizable deletion
- Settings: disclaimer toggle, L3 management, birthday setup, terms, privacy
- Birthday warning text on register/login forms
- Login attempts display for hardcore mode
- Export L3 passwords as text file
- Share links with live countdown timer
- L3 crypto password one-time view policy (viewed once then blocked, export always available)
- Admin birthday set (birthday: 2000-01-01) - login now asks birthday for admin
- Auto-suggest strong password when creating new vault items
- Smart Fill button for items with URLs (copies password + opens website)
- Browser Credential Management API integration (saves login to browser's password manager)
- Prominent "Share" labeled button on vault items
- Password Strength Meter in add/edit value field with weak/fair/strong color feedback
- Settings Dark/Light theme switcher with preference persistence
- Settings Auto-Lock Timer options: 1, 5, 15, 30 minutes for PIN Lock inactivity
- Settings Login History showing the last 5 successful login events with timestamp and device info
- Auth screen “+” quick toggle between login/register and readable wrong email/password errors
- Auth hardening: httpOnly access cookie set alongside JWT response, global 5-failure temporary lockout, backend credentialed CORS configuration, admin seed password refresh
- Public home page expanded into a longer, more professional pre-login experience with executive/security/trust sections
- Admin panel separated to `/admin`; admin/owner links removed from the main vault UI
- Website URL / Smart Fill UI removed from vault add/edit forms, item rows, and item properties
- Conditional Crypto Type Pass login confirmed: Layer 3 quiz appears only when Crypto Type Pass is enabled
- Settings "View My 20 Passwords" Crypto Pass button removed; Export Crypto Pass remains for offline backup
- Crypto Type Pass one-time API view enforced; export remains available
- Advance Mode hardened across reveal, edit, delete, TOTP, share, and bulk-delete paths
- Hardcore Mode fixed so configured failure limits trigger account/vault deletion immediately instead of being blocked by normal temporary lockout
- Public website contact section added with official ZNQ Telegram, support/partners email, and X links, plus matching footer links

## Latest Verification — 2026-09-03 Contact Links
- `python -m py_compile backend/server.py` passed
- `yarn build` passed with existing React hook dependency warnings in `App.js`
- Playwright UI smoke test passed on preview: contact section renders and Telegram, email, X, and footer links point to the requested destinations

## Latest Verification — 2026-09-03 Security Hardening
- `python -m py_compile backend/server.py` passed
- `yarn build` passed with existing React hook dependency warnings in `App.js`
- Self-test API security flow passed: conditional Crypto Pass status, birthday-to-complete when Layer 3 is off, one-time Crypto Pass view/export, Advance Mode endpoint protections, and Hardcore deletion at configured limit
- UI smoke test passed on preview: Settings opens, `l3-view-btn` is removed, and `l3-export-btn` remains
- Testing agent iteration 12 verified core requested frontend/backend flows; only reported issue is preview-edge CORS OPTIONS behavior, which is not app-code controlled. Local backend CORS and full iteration12 pytest passed: 7/7 with `REACT_APP_BACKEND_URL=http://localhost:8001`

## Latest Verification — 2026-09-03
- `python -m py_compile backend/server.py` passed
- `yarn build` passed with one existing React hook dependency warning in `App.js`
- Public API sanity checks passed for wrong-password error, admin birthday login, login history, auth cookie, and brute-force lockout
- `/app/backend/tests/test_iteration11_regression.py` passed locally: 15/15 with `REACT_APP_BACKEND_URL=http://localhost:8001`, `MONGO_URL`, and `DB_NAME`
- Testing agent iteration 11 verified requested frontend flows and Advance Mode/L3 regression; its external public OPTIONS CORS check remains platform-edge controlled, while backend localhost CORS now returns explicit origin + credentials
- UI smoke tested: long home sections render, `/admin` requires login and loads admin panel, main vault has no admin links, add/edit form has no website URL field

## Backlog
- P0: Monitor preview-edge CORS warning during deployment/production verification; app backend local CORS is correct
- P1: Continue remaining vault/security backlog: folders/tags, favorites, bulk actions, password history, duplicate detector, CSV import/export polishing
- P1: Add session management, two-device alerts, password expiry reminders, onboarding tour, dashboard stats
- P1: Premium tiers + Google Ad Manager tags (Stripe playbook required before implementation; Ad Manager waiting for user code)
- P2: Secure Share links re-evaluation
- P3: PostgreSQL migration (postponed)
