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
- 6-second enhanced loading screen
- Multi-layer auth (L1, L2 birthday, L3 crypto type pass)
- AES-encrypted vault CRUD, password generator, import/export
- Search & categories, TOTP, security dashboard, advance mode
- Vault PIN Lock, Admin Panel
- Hardcore Mode with customizable deletion
- Settings: disclaimer toggle, L3 management, birthday setup, terms, privacy
- Birthday warning text on register/login forms
- Login attempts display for hardcore mode
- Export L3 passwords as text file

## Backlog
- P1: Google Ad Manager tags (waiting for user code)
- P2: Secure Share links re-evaluation
- P3: PostgreSQL migration (postponed)
