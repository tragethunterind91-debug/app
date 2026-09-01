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
- Google AdSense monetization on public pages
- TopPass5 branding with custom CSS loading screen

## Dropped Features
- OTP/Twilio SMS authentication (explicitly cancelled by user)

## Tech Stack
- Frontend: React, Tailwind CSS, Shadcn/UI
- Backend: FastAPI, Motor (async MongoDB)
- Auth: JWT (joserfc), Google OAuth (authlib)
- Encryption: AES (cryptography.fernet)
- DB: MongoDB

## What's Been Implemented
- Full auth system (email/password, Google OAuth, recovery phrase, magic link reset)
- AES-encrypted vault CRUD
- Password generator
- Import/Export JSON
- Search & category filtering
- TOTP storage
- Security dashboard & breach monitoring
- Advance Mode toggle
- Vault PIN Lock (code injected, testing pending)
- Admin Panel (code injected, testing pending)
- 3-day lockout on advance mode (code injected, testing pending)
- Google AdSense script added (2026-02-25)

## Pending Validation
- Vault PIN Lock functionality
- Admin Panel stats endpoint & UI
- Advance Mode 3-day lockout
- Secure sharing links (user asked "where is that sharing links")

## Backlog (P0-P2)
- P0: Full end-to-end testing of injected features (PIN, Admin, Lockout)
- P0: Sharing links feature (clarification needed from user)
- P1: Ad placement control (show only on public pages, not inside vault)
- P2: UI/UX refinement on Advance Mode toggle
- P2: Migration/self-hosting prep if user requests
