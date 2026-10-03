# TopPass5 — VIP Plan (Spec Only, Not Yet Implemented)

**Last updated:** 3 Oct 2026
**Status:** 🔒 SPEC ONLY — do not build function/UI/UX yet. This file is the source of truth for scope.

---

## 💰 Pricing

| Plan | Duration | Price |
|---|---|---|
| **VIP** | 2 months 15 days (75 days) | **$1.50 USD** |

- One flat tier. No monthly/annual tiers for now.
- Everything in this document is **VIP-only**. Free users don't get any of it.
- "Updates" (new features shipped after a user becomes VIP) are **also VIP-only** — a VIP subscription includes all future updates listed under "Updates" below.

---

## 📋 Scope Rule

> **VIP = VIP features + all Updates.**
> If a feature is on this page, it is behind the VIP paywall. Free tier keeps the current TopPass5 functionality only (vault CRUD, 3-layer auth, Advance Mode, Hardcore Mode, Crypto Type Pass, basic share links, basic export).

---

## 🅰️ Updates (from the handwritten plan — all VIP-gated)

| # | Feature | Notes |
|---|---|---|
| U1 | **IP detections** | Alert / block on new IP, show IP + geo on login history |
| U2 | **Time-zone / country login lock** | Global time or country-specific window; outside window → login off / blocked |
| U3 | **Session auto off** | Configurable idle auto-logout (free = fixed 12h, VIP = 1 min – 30 days custom) |
| U4 | **Shout / auto logout** | Remote "logout all devices" button; one-tap kill-switch |
| U5 | **Share link with view-limit + password** | Set max views, expiry, and a passcode on each share |
| U6 | **Auto-check every password — liked / not** | Scheduled strength + breach check per item; thumbs-up/down per item |
| U7 | **Delete account effective or pass after BJ date** | Scheduled self-destruct on a chosen date, with pre-notice window |
| U8 | **Max 2 account logins per device** | Device-level account cap, prevents account farming |
| U9 | **Engineer mode with saving-limit percent** | Dev/power-user mode with a quota (e.g., 500 KB per user) for raw JSON exports, API tokens, custom fields |
| U10 | **Users / developer can save their data (≤500 KB each)** | Per-user object storage allowance for attachments inside Engineer mode |

---

## 🅱️ VIP Core Features (from earlier plan)

### 🔒 Security Power-Ups
- V1. Unlimited Advance Mode items
- V2. Multiple Crypto Type Passes (rotatable)
- V3. Breach monitoring (HaveIBeenPwned weekly scan)
- V4. Dark-web email monitor
- V5. Login-location push alerts
- V6. Panic PIN (decoy login to fake empty vault)
- V7. IP allowlist / country lock *(overlaps with U1/U2 — unify at build time)*

### 📦 Storage & Scale
- V8. Unlimited vault items (free = 50)
- V9. File attachments inside items (up to 10 GB total)
- V10. Rich-text / markdown secure notes
- V11. Unlimited password history (free = 10 versions)

### 👨‍👩‍👧 Sharing & Collaboration
- V12. Family / shared vault (up to 6 members)
- V13. Advanced share links *(same as U5 — unify)*
- V14. Share revocation + view analytics
- V15. Guest access by email
- V16. Multiple emergency / legacy contacts with per-contact wait periods

### 🧠 Smart Vault
- V17. AI password-strength coach
- V18. AI secret auto-categorizer
- V19. AI monthly vault audit (plain-English report)
- V20. Smart natural-language search
- V21. Password-generator presets (pronounceable, PIN, passphrase, bank-approved)
- V22. TOTP sync across devices

### 🎨 Experience & Polish
- V23. Custom themes (dark, matrix, neon, pastel)
- V24. Custom app icon (mobile)
- V25. Custom vault categories & icons
- V26. VIP badge on profile
- V27. Priority support (1-hour SLA)
- V28. Early access to new features
- V29. Ad-free guarantee

### 💾 Backup & Recovery
- V30. Automatic encrypted cloud backups (daily / weekly / monthly)
- V31. Export in multiple formats (1pux, Bitwarden JSON, encrypted ZIP)
- V32. Offline Crypto Type Pass PDF with QR codes
- V33. Trusted-contact N-of-M recovery
- V34. Time-machine restore (90-day vault history)

### 📊 Analytics Dashboard
- V35. Vault health score over time (chart)
- V36. Weakest-10 password rank
- V37. Age-of-passwords heatmap
- V38. Login timeline with device + location
- V39. Monthly security digest email

---

## 📈 Admin Metrics (from top of the note — track in Admin Panel)

These are admin-only stats, not VIP features. Add to the admin dashboard when VIP ships:

- M1. **Total ads shown** (if ads are added to free tier)
- M2. **Total revenue** (cumulative VIP sales × $1.50)
- M3. **Total Hardcore Pass users** (hardcore_enabled = true count)
- M4. **Total Advance Mode items created**
- M5. **Total TOTP items**
- M6. **Total VIP sold** (count of active + lifetime VIP purchases)

---

## 🧭 Build Order (when user says "start building VIP")

1. **Paywall infrastructure first** — Stripe + VIP state on user model + middleware gate (`require_vip`)
2. **Admin metrics (M1–M6)** — cheap, informs product decisions
3. **High-leverage security Updates:** U1, U2, U4, U8 (quickest wins, highest trust signal)
4. **Share-link upgrade:** U5 + V13 (unified) + V14
5. **Session + lifecycle controls:** U3, U7
6. **Backups & recovery:** V30, V31, V34
7. **AI features via Emergent LLM key:** V17–V19
8. **File attachments & engineer mode:** U9, U10, V9
9. **Family vault:** V12
10. **Polish:** V23–V29

---

## ❗ Decisions locked in (3 Oct 2026)

- **a. Payment:** fake / demo button only. Backend flips `vip_until` directly on click. No Stripe. Easy to swap later.
- **b. Renew model:** one-time **75-day** purchase, expires silently. User can re-buy anytime. No subscription webhooks.
- **c. On expiry:** silent auto-downgrade to free. Vault stays fully read+write; only VIP-only features (U/V items) lock.
- **d. "2 account logins per device":** interpreted as **2 accounts max per device** (anti-farming). Enforce via device fingerprint.
- **e. Ads metric:** track-only, no ads shown.
