# TopPass5 — Project Summary

## What's Built & Working

### Core Vault
- AES-256 encrypted password/value storage (CRUD)
- Password generator (random secure passwords)
- Import/Export (JSON format)
- Search & category filtering
- TOTP secret storage per item
- Advance Mode (custom passphrase per item, 3-day lockout on 4 fails)
- Vault PIN Lock (4-digit, auto-lock after 5 min inactivity)
- Security Dashboard (breach monitoring, password strength analysis)

### Multi-Layer Authentication
- **Layer 1**: Email + Password login
- **Layer 2**: Birthday verification (double-confirm on register, verify every login, NO forgot option)
- **Layer 3 (Crypto Type Pass)**: 20 random 5-char passwords, quiz on 3 random positions, toggle on/off (values persist), max 3 regenerations/month
- **Hardcore Mode**: Auto-delete account + all data on configurable failure limits (daily tries, total fails, consecutive days, L3 fails)

### Landing Page
- Hero section: "Your passwords deserve a fortress"
- 6 feature cards (AES-256, Multi-Layer Auth, Crypto Type Pass, Hardcore Mode, Zero Knowledge, Advance Mode)
- Security badges bar
- "Get Started" → Auth screen
- Footer with ZNQ NETWORK branding

### Loading Screen (6 seconds)
- Shield icon (pulsing animation)
- TOPPASS5 title
- "SECURING YOUR VAULT" subtitle
- Security feature badges (AES-256, 3-Layer Auth, Zero Knowledge)
- Tagline: "Military-grade security for your passwords"
- ZNQ NETWORK logo + "Safety First • Security Always • Data Protected"
- Dot grid background

### Settings Menu
- Browser Autofill toggle
- Vault PIN Lock toggle + setup
- **Layer 2 — Birthday**: Set birthday (legacy users, one-time permanent)
- **Layer 3 — Crypto Type Pass**: Toggle lock, View 20 passwords, Export as text file, Regenerate (3/month max, requires password)
- **Security**: Disclaimer toggle (user enables, not auto-shown)
- **Hardcore Mode**: Enable/disable, customize all limits, view failure status
- **Legal**: Terms & Conditions, Privacy Policy
- **Log Out** (returns to landing page)

### Login Screen Features
- Birthday hint: "You will need your birthday to complete sign-in"
- Register birthday warning: "Please enter correctly — used for login verification"
- Hardcore Mode warning: Shows daily tries, total fails, consecutive days when active

### Admin Panel
- Owner stats: members online, total passwords
- Accessible via ?admin=1 URL parameter

---

## What's Been Removed
- Google OAuth login (security risk per user request)
- Recovery phrase (security risk — hacker could use to block user)
- Forgot password for L1 and L2
- Auto-shown disclaimer popup (now a Settings toggle)

---

## What's Left / Backlog (Not Built)

### Waiting on User
- **Google Ad Manager Tags** — Need user's exact Ad Manager code to integrate

### Available to Build (user has the full list, numbers 1-26)
1. Password Strength Meter
2. Auto-Lock Timer (custom durations)
3. Login History (IP, device, time)
4. Two-Device Alert
5. Session Management
6. Password Expiry Reminders
7. Breach Check (HaveIBeenPwned)
8. Password Generator Pro
9. Vault Search Filters
10. Folders/Tags
11. Favorites
12. Bulk Actions
13. Notes Field
14. Custom Fields
15. Password History
16. Duplicate Detector
17. CSV Import (Chrome, Firefox, LastPass, 1Password)
18. Encrypted Export
19. Dark/Light Theme Toggle
20. Mobile Responsive Polish
21. Keyboard Shortcuts
22. Dashboard Stats
23. Onboarding Tour
24. Ad Manager Tags
25. Premium Tier (Stripe)
26. Share Vault Item (secure time-limited link)

### Postponed
- PostgreSQL migration (user explicitly postponed, using MongoDB)

---

## Tech Stack
- **Frontend**: React, Tailwind CSS, Lucide Icons, Sonner (toasts)
- **Backend**: FastAPI, Motor (async MongoDB)
- **Auth**: JWT (joserfc), bcrypt password hashing
- **Encryption**: AES-256 (cryptography.fernet)
- **Database**: MongoDB

## Key Files
- `/app/backend/server.py` — All API logic
- `/app/backend/.env` — Backend secrets (MONGO_URL, DB_NAME, VAULT_KEY, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASS)
- `/app/frontend/src/App.js` — All React components
- `/app/frontend/src/App.css` — All styling
- `/app/frontend/src/AdminPanel.js` — Admin interface
- `/app/frontend/.env` — Frontend config (REACT_APP_BACKEND_URL)

## Test Credentials
- **User**: test@toppass5.com / Test1234! (birthday: 1995-03-20)
- **L2+L3 User**: testl2@toppass5.com / Test1234! (birthday: 1990-01-15, hardcore enabled)
- **Admin**: admin@toppass5.com / TopPass5Owner!2024
