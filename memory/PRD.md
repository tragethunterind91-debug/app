# TopPass5 Secure Vault — PRD

## Original Problem Statement
1. Import app from GitHub: `https://github.com/tragethunterind91-debug/app`
2. User pivoted to visual redesign — chose Hybrid Command Center direction (futuristic security telemetry base + premium gold/glass accents + restrained cinematic pacing + subtle terminal/glitch details). Requested loading screen show company + app name.

## Decisions Made
- **Kept MongoDB.** Free on Emergent even in production. No migration.
- **No Firebase Auth.** Would break the 3-layer + hardcore-delete security model of a password vault.
- **Hybrid Command Center visual redesign applied** across LoadingScreen, LandingPage, Auth flows, Vault Dashboard, and Modals. Palette shifted from `#4b8cff` (blue) to `#E5B842` (sovereign gold) with tactical obsidian backgrounds and glass surfaces.

## Architecture
- **Frontend**: React (CRA) at `/app/frontend`
- **Backend**: FastAPI at `/app/backend/server.py`
- **DB**: MongoDB via Motor
- **Crypto**: AES-256 (Fernet) for vault items, JWT for sessions
- **Auth flow**: 3-layer (Password → Birthday → Layer 3 quiz)

## Design System (Hybrid Command Center)
- **Primary accent**: Sovereign Gold `#E5B842` / `#F0C859`
- **Base backgrounds**: Tactical Obsidian `#07090E`, `#0D111A`, `#131926`
- **Telemetry cyan**: `#38BDF8`
- **Fonts**: Outfit (headings), Manrope (body), DM Mono (telemetry data)
- **Glass surfaces**: `rgba(19,25,38,.72)` + `backdrop-filter: blur(12px)`
- **Motion**: Restrained cinematic (0.3s modal fade, staggered letter reveals, orbital rotations, gold beam sweeps)
- **Loading screen**: Company label "ZNQ NETWORK · SECURE SYSTEMS" above shield, gold shimmer wordmark, corner brackets, gold beam sweep, telemetry chips
- **Full guidelines**: `/app/design_guidelines.md`

## Files Modified (Design Pass)
- `/app/frontend/src/index.css` — fonts, scrollbar, reduced-motion, gold selection
- `/app/frontend/src/App.css` — palette (`--blue` → gold), glass modals, gold primary CTAs, gold nav-active, gold empty state, refined hover states, focus rings
- `/app/frontend/src/LandingPage.css` — all blue → gold, orbital rings, chips, buttons, hero glow
- `/app/frontend/src/LoadingScreen.css` — full rewrite with gold shimmer, ZNQ company label, corner brackets, gold beam, telemetry chips
- `/app/frontend/src/LoadingScreen.js` — added `tp5-load-company` element ("ZNQ NETWORK · SECURE SYSTEMS")

## Features (all pre-existing, preserved)
- Multi-layer authentication with Hardcore Mode
- AES-256 encrypted vault
- Password Generator (Random + Passphrase modes)
- Import / Export JSON
- Bulk selection & delete
- Tags, Favorites, Categories, Duplicate detection
- TOTP support per item
- Breach check
- Advance Mode (per-item passphrase lock)
- Share via expiring links
- Password history
- Dark / Light theme toggle
- Login history & device tracking
- Admin panel

## Test Credentials
See `/app/memory/test_credentials.md`.

## Health
- Backend `/api/` → `{"message":"CryptonVault API"}` — OK
- Frontend loading screen with gold shimmer TOPPASS5 wordmark — OK
- Landing page hero + auth screen + vault dashboard all in gold theme — OK
- Mobile viewport 390px — no horizontal overflow, layout intact — OK
- All existing data-testid attributes preserved — OK

## Backlog
- CSV Import from Chrome/Firefox/LastPass
- Emergency access contact
- Recovery code print sheet
- Browser extension bridge
