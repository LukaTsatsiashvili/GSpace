# Authentication foundation — implementation notes

Branch: feature/auth-foundation, created from GSpace-production.

Delivered in this first increment: identity database baseline, six built-in roles, login/session API, read-only role-restricted directory API, frontend login gate.
Not yet delivered: Administration CRUD writes, account invitations, recovery emails, MFA, real business modules and production hardening. NOT READY FOR PUBLIC DEPLOYMENT.

## Local setup — Node 22+, PostgreSQL 17

1. Use a **new/empty** GSpace database. The checked-in baseline migration creates the initial schema and is not a migration for an already populated database. Start the local database using installed PostgreSQL or run: `docker compose up -d db`.
2. Install dependencies at repository root: `npm ci`.
3. Copy `apps/api/.env.example` to `apps/api/.env`. Edit `DATABASE_URL`, `WEB_ORIGIN` and set a fresh random `AUTH_SECRET`. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`. Never use or commit the placeholder.
4. Run `npm run db:generate` then `npm run db:deploy -w @gspace/api`.
5. For the **first user only**, set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` and `BOOTSTRAP_ADMIN_PASSWORD` in the shell environment (password must have at least 15 characters). Never commit or paste these secrets into a chat. In PowerShell use Read-Host -AsSecureString and inject the temporary password via your shell's secret-handling mechanism.
6. Run `npm run admin:bootstrap -w @gspace/api`. The command refuses to modify an existing installation with users. Clear bootstrap credentials from the environment immediately.
7. Run `npm run dev` and visit `http://localhost:5173`. Sign in with the initial administrator.
8. Run `npm run typecheck`, `npm run build`, and `npm run test -w @gspace/api`.

## HTTP API

- GET /api/health — service liveness, does not check PostgreSQL
- GET /api/v1/auth/csrf — CSRF cookie and one-time request token
- POST /api/v1/auth/login — authenticate and create session cookie
- POST /api/v1/auth/logout — revoke current session
- GET /api/v1/auth/me — signed-in identity
- GET /api/v1/auth/sessions — currently active user sessions
- POST /api/v1/auth/sessions/revoke — revoke owned session
- POST /api/v1/auth/change-password — verify old password, change hash and revoke all sessions
- GET /api/v1/admin/users, /roles, /branches — **read-only** catalogs guarded by permissions

All POST requests require a JSON body and matching X-CSRF-Token header and CSRF cookie; Origin is checked when present. Sessions are stored hashed in PostgreSQL. Cookies are HttpOnly, SameSite=Strict and Secure under NODE_ENV=production. Absolute session lifetime: 8 hours. Idle lifetime: 30 minutes. Backend permissions are loaded on each request, not cached in the browser.

Password hashing uses memory-hard native scrypt with N=2^17, r=8, p=1. This is an OWASP-supported fallback where Argon2id has not yet been integrated; no new native npm dependency is introduced in this change. Login failures use account-based, progressive temporary throttling in PostgreSQL. Compromised-password screening, administrator MFA, trusted proxy IP policy and distributed IP throttling are **required follow-ups** before exposing the application publicly.

## Limitations

- Existing Administration UI is still illustrative; it is **not yet connected** to the new read-only endpoints and no user/role changes are saved from the UI.
- Application business pages are still static prototypes; navigation gating is not a substitute for backend permission checks.
- Existing User / Role data in the frontend is illustrative and must not be used as real identities.
- Do not deploy to production until MFA, account invitations, recovery/reset flows, real Administration CRUD, backup/restore checks and independent security review are completed.
- Initial migration and first-user bootstrap must be run on the **user's own intended PostgreSQL environment**; no remote database was changed by this branch.

CI in GitHub Actions starts disposable PostgreSQL 17, runs the checked-in migration, creates a synthetic administrator, checks TypeScript/build and executes password + HTTP integration tests.
