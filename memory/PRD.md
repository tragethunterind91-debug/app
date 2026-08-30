# TopPass5 Product Requirements

## Original problem statement
Make a website for saving the password or values with name and very tight security, with backend, Google and email/password login, adding and deleting values, sharing/recovery, copying values, and downloading one or all values.

## Architecture decisions
- React frontend with FastAPI backend and MongoDB persistence.
- JWT sessions for email/password and Google OAuth account linking.
- Vault values are encrypted with Fernet before MongoDB storage; list responses never include plaintext.
- Frontend uses the configured external backend URL and protected environment variables remain intact.

## User personas
- Individuals keeping passwords, API keys, secure notes, and other named secrets.
- A vault owner who occasionally needs a controlled share or export.

## Core requirements (static)
- Secure registration/login, Google login, named values, add/reveal/copy/export/delete.
- Recovery response and expiring share link support.
- Responsive, calm dark security-focused interface branded TopPass5.

## Implemented (2026-08-30)
- Email/password registration and login, Google OAuth redirect/callback, JWT-protected API.
- Encrypted vault CRUD, reveal endpoint, expiring shares, recovery code response.
- Responsive TopPass5 UI with mobile-safe reveal, copy fallback, downloads, search, and logout.
- Required data-testid coverage on user-facing controls and critical values.

## Prioritized backlog
- P0: Complete a browser retest once preview navigation is responsive, specifically denied-clipboard copy followed by delete/logout.
- P1: Add email delivery for recovery and share password verification UI.
- P1: Add edit/share dialogs and audit history screen.
- P2: Add password generator and security health audit.

## Remaining next tasks
- Validate Google OAuth redirect URLs for the final server origin.
- Add recovery email provider and a user-facing share unlock screen.
- Add encrypted export option and stronger client-side vault unlock ceremony.