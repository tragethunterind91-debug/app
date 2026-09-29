# Design Guidelines: TOPPASS5 Secure Vault (CryptonVault API by ZNQ NETWORK)

## 1. Visual Strategy & Core Identity
**Design Direction:** Hybrid Command Center (Tactical Obsidian Security Telemetry base + Sovereign Gold & Glass Accents + Restrained Cinematic Pacing + Subtle HUD/Glitch details).
**Branding & Credits:**
- **App Name:** TOPPASS5
- **Internal API Branding:** CryptonVault API
- **Credit Line:** by ZNQ NETWORK

---

## 2. Color System & CSS Custom Properties

### Dark Base Palette (Primary Command Center)
```css
:root {
  /* Surface & Base */
  --bg-root: #07090E;             /* Tactical Obsidian */
  --bg-panel: #0D111A;            /* Carbon Command Surface */
  --bg-card: #131926;             /* Telemetry Glass Base */
  --bg-card-glass: rgba(19, 25, 38, 0.75);
  
  /* Borders & Strokes */
  --border-subtle: rgba(255, 255, 255, 0.08);
  --border-gold: rgba(229, 184, 66, 0.35);
  --border-cyan: rgba(56, 189, 248, 0.25);
  
  /* Typography */
  --text-main: #F3F5F9;
  --text-muted: #8A94A6;
  
  /* Sovereign Gold Accents (Privileged CTAs & Badges) */
  --gold-primary: #E5B842;
  --gold-hover: #F0C859;
  --gold-glow: rgba(229, 184, 66, 0.22);
  --gold-border: rgba(229, 184, 66, 0.4);
  
  /* Telemetry Hues */
  --telemetry-cyan: #38BDF8;
  --status-emerald: #10B981;
  --status-danger: #EF4444;
  --status-warning: #F59E0B;
}
```

### Light Theme Tokens
```css
html[data-theme='light'] {
  --bg-root: #F4F7FB;
  --bg-panel: #FFFFFF;
  --bg-card: #FFFFFF;
  --border-subtle: rgba(19, 28, 44, 0.12);
  --border-gold: rgba(184, 134, 11, 0.4);
  --text-main: #0F172A;
  --text-muted: #5F6C80;
  --gold-primary: #B8860B;
  --gold-hover: #996515;
}
```

---

## 3. Typography & Font Pairing

1. **Headings & Primary Display:** `Outfit`, `Clash Display`, or `Cabinet Grotesk` (Weight: 700 / 800)
   - *Forbidden:* Inter, Roboto, Arial, System-UI default.
2. **Data Telemetry & Secrets:** `DM Mono` or `JetBrains Mono`
   - Used for passwords, OTP codes, SHA-256 hashes, status chips, progress percentages, and telemetry metrics.
3. **Body & Controls:** `Manrope` or `DM Sans` (Weight: 400 / 500 / 600)

---

## 4. Key Surface Specifications

### A. Loading Screen ("TOPPASS5" by ZNQ NETWORK)
- **Title Wordmark:** "TOPPASS5" with metallic gold shimmer and subtle telemetry pulse.
- **Credit Line:** "by ZNQ NETWORK" with the ZNQ logo emblem.
- **Centerpiece:** Animated orbital shield HUD containing `Lock`, `KeyRound`, and `Skull` icons rotating around the core.
- **Status Chips:** `AES-256`, `3-Layer Auth`, `Zero-Knowledge`.
- **Progress Telemetry:** Live percentage counter and step-by-step security initialization status logs.

### B. Multi-Layer Auth Flow
- **Layer 1:** Email + Master Password.
- **Layer 2:** Birthday Verification (Explicit checkpoint: "No recovery by design").
- **Layer 3:** Crypto Type Pass (Quiz on 20 unique crypto passwords).
- **Hardcore Mode Banner:** Tactical warning box showing daily/total failure limits and remaining attempts.

### C. Vault Dashboard & Command Center
- **Sidebar:** Brand mark with ZNQ logo, space navigation (`Vault`, `Activity`, `My Share Links`, `Security Report`, `Settings`, `Help & Guide`), and user pill.
- **Topbar:** Title greeting + Top action bar: `Import`, `Export`, `Generator Pro`, and Gold Primary `+ Add value` button.
- **Metrics Bar:** 3 Command Cards: Protected Values count, Security Health status, and Duplicate Password alerts.
- **Vault Items Grid:**
  - Glass cards with 1px subtle borders.
  - Category chips & tags filter row.
  - Gold favorite stars, duplicate badges, Advance Mode passphrase lock indicators, inline TOTP timer copy button.

### D. Modals & Security Tools
- **Add / Edit Item Modal:** Password input with inline `Generate` button, password strength meter, custom field editor, tags input, notes textarea, and Advance Mode toggle.
- **Password Generator Pro:** Random vs Passphrase toggle, length slider (8-64), character set checkboxes, regenerate & copy buttons.
- **Expiring Share Modal:** Expiry duration selector (1h, 12h, 24h, 7d), live countdown timer, share link copy, and active share revocation manager.

---

## 5. Accessibility & Test Integrity Rules
- **Data-Testid Attributes:** Every existing `data-testid` in `App.js`, `VaultItems.js`, `SettingsPanel.js`, `LandingPage.js`, `LoadingScreen.js`, `AdminPanel.js` MUST be strictly preserved.
- **Contrast Ratios:** Gold text and CTAs must maintain at least 4.5:1 contrast against `#07090E` and `#0D111A`.
- **Iconography:** Strictly use `lucide-react`. Absolutely zero emoji characters in UI icons.
