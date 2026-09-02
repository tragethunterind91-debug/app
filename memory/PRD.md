# TopPass5 — Secure Vault PRD

## Original Problem Statement
Build a website for saving passwords/values with tight security (TopPass5). Users can store, add, edit, delete, copy, search, and export/import values.

## User Personas
- **End Users**: Individuals who want a secure, encrypted vault for passwords and sensitive values.
- **Admin/Owner**: Site owner who monitors usage via an Admin Panel.

## Core Requirements
- AES encryption for all stored vault items
- CRUD operations (Add, Edit, Delete, Copy)
- Password generator
- Import/Export (JSON)
- Search & Category filtering
- TOTP secret storage
- Security Dashboard with breach monitoring
- Advance Mode (custom passphrase for specific items, 3-day lockout on failed attempts)
- Vault PIN Lock
- Crypto-wallet style recovery phrase
- Magic Link password reset
- Admin Panel (owner stats: members online, total passwords)
- Google ad monetization: AdSense removed; Google Ad Manager pending user-provided tag/code
- TopPass5 branding with custom CSS loading screen

## Multi-Layer Authentication (Phase 1 - IMPLEMENTED)
- **Layer 1**: Email/Password login (standard)
- **Layer 2**: Birthday verification (required at registration with double confirm, verified on every login). NO forgot birthday.
- **Layer 3**: 20 crypto-style passwords (5 random chars each: letters+digits+symbols). System quizzes user on 3 random positions before granting access. User can toggle on/off (passwords persist). Quiz required to enable. Max 5 regenerations per week.
- **Hardcore Mode**: Optional auto-delete account + all passwords if:
  - User fails login X consecutive days (default 4)
  - User fails Y total times (default 16, limit of Z tries per day, default 4)
  - User fails Layer 3 quiz W times (default 8)
  - All limits customizable by user

## Settings Menu (Phase 1 - IMPLEMENTED)
- Browser Autofill toggle
- Vault PIN Lock toggle + setup
- Layer 3 Lock toggle (requires quiz to enable)
- View My 20 Passwords
- Regenerate Passwords
- Hardcore Mode settings
- Terms & Conditions
- Privacy Policy
- Log Out

## Disclaimer Popup (Phase 1 - IMPLEMENTED)
- First-login popup: "if any password is leaked we are not responsible"
- Shown once, accepted permanently

## Dropped Features
- OTP/Twilio SMS authentication (explicitly cancelled by user)

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI
- Backend: FastAPI, Motor (async MongoDB)
- Auth: JWT (joserfc), Google OAuth (authlib)
- Encryption: AES (cryptography.fernet)
- DB: MongoDB

## What's Been Implemented (as of Feb 2026)
- Full auth system (email/password, Google OAuth, recovery phrase, magic link reset)
- Multi-layer auth: L1 email/password, L2 birthday, L3 crypto-quiz
- Hardcore Mode with customizable deletion triggers
- Disclaimer popup on first login
- AES-encrypted vault CRUD
- Password generator
- Import/Export JSON
- Search & category filtering
- TOTP storage
- Security dashboard & breach monitoring
- Advance Mode toggle
- Vault PIN Lock
- Admin Panel
- 3-day lockout on advance mode
- Expanded Settings: L3 management, Hardcore settings, Terms, Privacy, Logout
- Legacy user support (auto-generates L3 passwords on first access)

## Pending Bugs (Phase 2)
- P1: Loading screen not visible
- P1: "Last confirm button" when making a password not visible

## Backlog
- P1: Google Ad Manager tags (waiting for user to provide exact code)
- P2: Secure Share links re-evaluation
- P3: PostgreSQL migration (explicitly postponed by user)
