# Custom Auth Testing Notes for TopPass5

## Relevant auth flows
- `POST /api/auth/register` creates a vault with email, password, birthday.
- `POST /api/auth/login` may return `stage: birthday` when birthday verification is required.
- `POST /api/auth/verify-birthday` completes login or returns `stage: layer3`.
- `POST /api/auth/verify-layer3` completes Layer 3 login.
- `GET /api/auth/me` validates the current Bearer token.
- `GET /api/auth/login-history` returns the last 5 completed login events for Settings.

## Regression focus
- Wrong email/password must show a safe, readable error and must not crash the UI.
- Birthday and Layer 3 staged tokens must not access full-auth endpoints.
- Advance Mode items must reject `/api/items/{id}/value` and require `/api/items/{id}/advance-reveal`.
- Login history must exclude Mongo `_id` and return JSON-safe fields only.
