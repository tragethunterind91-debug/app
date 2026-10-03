# TopPass5 — Secure Vault (ZNQ Network)

## Original Problem Statement
Import `https://github.com/tragethunterind91-debug/app` (branch `conflic`), resolve any git merge conflict markers, install dependencies for React + FastAPI, set up `.env` with mock secrets, verify the live preview, then run a full QA pass on vault, 3-layer auth, and advance mode.

## Session Setup Status (Feb 2026)
- Repo cloned from branch `conflic` into `/app`. No actual git conflict markers present.
- Backend deps installed; missing transitive deps (`limits`, `Deprecated`, `wrapt`) + `emergentintegrations` added. `requirements.txt` is now the pip-frozen snapshot — fresh installs are reproducible.
- Frontend deps installed via `yarn`.
- Mock `.env` secrets added for local dev: `VAULT_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASS`, `ADMIN_BIRTHDAY`, `EMERGENT_LLM_KEY`.
- All supervisor services running (backend :8001, frontend :3000, mongodb).
- Preview live: https://branch-verify-3.preview.emergentagent.com.

## QA Status
- Iteration 1 (full sweep): 19/19 backend pytest + frontend smoke all pass. Flagged 2 issues:
  1. `/api/admin/stats` missing router decorator.
  2. Topbar greeting/actions collision at ~1280px.
- Both fixed in /app/backend/server.py L877 and /app/frontend/src/App.css (`.topbar` + `@media(max-width:1380px)`).
- Iteration 2 (focused retest): 4/4 pytest + 1280px layout screenshot — both fixes verified by the testing agent.

## Tech Stack
- Frontend: React (CRA + CRACO), Tailwind, shadcn/ui
- Backend: FastAPI, Motor (MongoDB async), slowapi, passlib[bcrypt], jose, authlib, cryptography
- DB: MongoDB (local)

## Admin Credentials
See `/app/memory/test_credentials.md`.

## Backlog
- server.py (~1150 lines) could be split into routers (auth, items, vip, emergency, admin).
- `CORS_ORIGINS='*'` is dev-only — tighten to explicit origins before shipping.
- File & media storage integration (deferred earlier by user).
