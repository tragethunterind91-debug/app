# TopPass5 — Secure Vault PRD

## Original Problem Statement
Build a website for saving passwords/values with tight security (TopPass5). Users can store, add, edit, delete, copy, search, and export/import values.

## Core Requirements
- AES encryption for all stored vault items
- CRUD operations, Password generator, Import/Export, Search & Category filtering
- TOTP secret storage, Security Dashboard with breach monitoring
- Advance Mode (custom passphrase per item, 3-day lockout)
- Vault PIN Lock, Recovery phrase, Magic Link reset, Admin Panel

## Multi-Layer Authentication (IMPLEMENTED)
- **Layer 1**: Email/Password
- **Layer 2**: Birthday verification (double-confirm on register, verify on login). NO forgot birthday. Legacy users can add birthday from Settings (one-time, permanent).
- **Layer 3 (Crypto Type Pass)**: 20 passwords (5 random chars each). Quiz on 3 random positions during login. Toggle on/off (passwords persist). Quiz required to enable. Max 5 regenerations/week. Export as text file.
- **Hardcore Mode**: Auto-delete account on configurable failure limits. Login screen shows remaining tries/status when active.

## Settings Menu (IMPLEMENTED)
- Browser Autofill, Vault PIN Lock
- Layer 2 — Birthday: Set/view status
- Layer 3 — Crypto Type Pass: Toggle lock, View passwords, Export passwords, Regenerate
- Hardcore Mode: Enable/disable, customize limits
- Terms & Conditions, Privacy Policy, Log Out

## Disclaimer Popup (IMPLEMENTED)
- First-login popup shown once, accepted permanently

## Login Attempts Display (IMPLEMENTED)
- Shows Hardcore Mode warning on login screen: daily tries used, total fails, consecutive days

## What's Been Implemented
- Full auth system (email/password, Google OAuth, recovery phrase, magic link reset)
- Multi-layer auth: L1, L2 birthday, L3 crypto type pass quiz
- Hardcore Mode with customizable deletion triggers
- Disclaimer popup, expanded Settings
- Birthday setup for legacy users
- Login attempts display for Hardcore Mode users
- Export L3 passwords as formatted text file
- AES-encrypted vault CRUD, Password generator, Import/Export
- Search & categories, TOTP storage, Security dashboard
- Advance Mode, Vault PIN Lock, Admin Panel
- Loading screen fix, Confirm button fix

## Backlog
- P1: Google Ad Manager tags (waiting for user to provide exact code)
- P2: Secure Share links re-evaluation
- P3: PostgreSQL migration (explicitly postponed by user)
