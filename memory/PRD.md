# TopPass5 — Secure Vault (ZNQ Network)

## Original Problem Statement
Import `https://github.com/tragethunterind91-debug/app` (branch `conflic`), resolve any git merge conflict markers, install dependencies for React (frontend) + FastAPI (backend), set up `.env` with mock secrets, and verify the live preview renders.

## Session Setup Status (Feb 2026)
- Repo cloned from branch `conflic` into `/app`.
- Conflict scan: no actual `<<<<<<<`/`>>>>>>>` markers present on the branch. Working tree clean.
- Backend dependencies installed (`pip install --no-deps -r requirements.txt` + patched missing `limits`, `deprecated`, `wrapt`, plus `emergentintegrations`).
- Frontend dependencies installed with `yarn install`.
- Mock `.env` secrets added for local dev: `VAULT_KEY`, `SESSION_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASS`, `ADMIN_BIRTHDAY`, `EMERGENT_LLM_KEY`.
- Supervisor services running: backend (:8001), frontend (:3000), mongodb.
- Preview verified: https://branch-verify-3.preview.emergentagent.com renders the TopPass5 landing/loading screen (HTTP 200 on `/` and `/api/`).

## Tech Stack
- Frontend: React (CRA + CRACO), Tailwind, shadcn/ui
- Backend: FastAPI, Motor (MongoDB async), slowapi, passlib[bcrypt], jose, authlib, cryptography
- DB: MongoDB (local)

## Mock Credentials (local only)
See `/app/memory/test_credentials.md`.

## Backlog
- Smoke-test auth flow (register / login / vault CRUD) end-to-end.
- Optional: pin missing transitive deps into `requirements.txt` (currently installed outside of lockfile).
- Optional: run the testing agent for a full regression on vault + L3 + advance mode.
- File & media storage integration (deferred per user request).
