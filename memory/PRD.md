# TopPass5 — Secure Vault (ZNQ Network)

## Original Problem Statement
Import `https://github.com/tragethunterind91-debug/app` (branch `conflic`), resolve any git merge conflict markers, install dependencies for React + FastAPI, set up `.env` with mock secrets, verify the live preview, run a full QA pass on vault / 3-layer auth / advance mode, then promote every feature shown in the VIP modal from "spec only" to real, testable backend behaviour.

## Session Status (Feb 2026)
- Repo cloned from branch `conflic` into `/app`. No actual git conflict markers present.
- Backend deps installed + pinned in `requirements.txt`; frontend deps installed via `yarn`.
- Mock `.env` secrets added: `VAULT_KEY`, `SESSION_SECRET`, `ADMIN_*`, `EMERGENT_LLM_KEY`.
- Supervisor services (backend :8001, frontend :3000, mongodb) all running.
- Preview: https://branch-verify-3.preview.emergentagent.com.

## QA Status
- Iteration 1 (full sweep): 19/19 backend pytest + frontend smoke all pass. 2 issues flagged, both fixed.
- Iteration 2 (focused retest): 4/4 fixes verified.
- Iteration 3 (VIP feature sweep): **19/19 pass** on new VIP capability suite in `/app/backend/tests/test_vip_features.py`.

## VIP Features — Now Live (backend)
Every item advertised in the professional VIP modal is now wired into the backend. Admin becomes VIP via `POST /api/vip/purchase`.

| # | Feature | Implementation |
|---|---------|---------------|
| 1 | Unlimited Advance Mode items | Free tier capped at 3 (`FREE_ADVANCE_LIMIT`); VIP unlimited |
| 2 | IP allowlist | `vip_settings.allowed_ips`; enforced on login |
| 3 | Country lock | `vip_settings.allowed_countries` (ISO-2); checks `cf-ipcountry` header |
| 4 | Remote logout all devices | `POST /api/vip/logout-all` rotates `jwt_salt`, old tokens → 401 |
| 5 | Scheduled self-destruct | `vip_settings.self_destruct_at`; wipes items + shares + rejects access |
| 6 | Share link v2 (view-limit + password) | `POST /api/items/{id}/share` accepts `max_views` + `password` (VIP-only) |
| 7 | Trusted device cap | Free=1, VIP=2; `GET/DELETE /api/vip/devices` |
| 8 | Custom session timeout | `vip_settings.session_timeout_min` drives JWT `exp` |
| 9 | Engineer Mode + 500 KB storage | `GET/PUT /api/vip/engineer/blob`, hard 413 at 500 KB |
| 10 | Custom themes + VIP badge | `vip_settings.theme` (default/matrix/neon/pastel); badge already present |

### New endpoints (all `require_vip`)
- `GET  /api/vip/settings` · `PUT /api/vip/settings`
- `POST /api/vip/logout-all`
- `GET  /api/vip/devices` · `DELETE /api/vip/devices/{id}`
- `GET  /api/vip/engineer/blob` · `PUT /api/vip/engineer/blob`

### Hooked into existing flows
- `token_for()` — honours per-user session_timeout_min + embeds jwt_salt
- `verify_fresh_session()` — gatekeeper for logout-all + self-destruct
- `_enforce_vip_login_policy()` — called inside `/api/auth/login`: IP, country, self-destruct, device cap
- `create_item()` — enforces 3-item free Advance Mode cap

## Tech Stack
- Frontend: React (CRA + CRACO), Tailwind, shadcn/ui
- Backend: FastAPI, Motor (MongoDB async), slowapi, passlib[bcrypt], jose, authlib, cryptography
- DB: MongoDB (local)

## Backlog
- **Frontend VIP settings UI**: all 10 features are callable via API but have no settings panel in the UI yet.
- **Theme implementation**: backend stores theme, frontend currently ignores it — wire up a theme switcher.
- **PATCH semantics for /vip/settings**: current PUT overwrites all fields.
- **Self-destruct scope**: wipes items + shares; does not touch preferences, password_history, login_history.
- **Device fingerprint hardening**: currently SHA-256(UA)[:16] — spoofable; consider UA+IP or a signed cookie.
- **Router split**: server.py is ~1370 lines — move to `backend/routes/{auth,items,vip,share,admin}.py`.
- **Country-code header fallback**: preview ingress strips `cf-ipcountry`; add a second header the ingress preserves.
- **File & media storage integration** (deferred by user).

## Admin Credentials
See `/app/memory/test_credentials.md`.
