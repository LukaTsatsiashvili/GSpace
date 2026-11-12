# GSpace authentication, account activation and password security

The authentication foundation is connected to PostgreSQL, alongside Administration Users, Roles and Organization (Branches/Departments). Business pages remain design previews, not production workflows.

## Local development

1. Use Node.js 22+ and PostgreSQL 17. Configure `DATABASE_URL`, `WEB_ORIGIN`, and a **fresh 32-byte or longer random** `AUTH_SECRET` in `apps/api/.env`.
2. Install dependencies: `npm ci`.
3. Apply database migrations: `npm run db:generate` and `npm run db:deploy -w @gspace/api`.
4. For a **new/empty** database only, set `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` and `BOOTSTRAP_ADMIN_PASSWORD`. The minimum password length is **6 characters** (maximum 1024); a long, unique passphrase is strongly preferred. Do not commit or share any credentials.
5. Run `npm run admin:bootstrap -w @gspace/api` once. Remove bootstrap credentials from the shell environment.
6. Run `npm run dev` and visit `http://localhost:5173`.

Existing accounts and password hashes remain valid; lowering the minimum does not reset stored passwords.

## Account workflows

- **Activation:** Administration → Users → Add user provides a one-time link in local development. The recipient opens it and chooses a password. Minimum length: 6 characters.
- **Self-service change:** Click your account in the topbar → **My profile → Security**. Submit current password, new password, and confirmation. The backend checks the old password, rejects reusing it, hashes the replacement with scrypt and revokes **all** the user's sessions. The user must sign in again.
- **Administrator reset:** Administration → Users → select an account → Reset password. An authorized administrator provides an audit reason and issues a one-time reset link. Existing sessions are revoked, and sign-in is disabled until the new password is set. This is an administrator-managed fallback if the user forgets their password.
- **Link security:** Activation and reset links expire in 60 minutes, are single-use and are invalidated after successful redemption. The token is hashed in PostgreSQL.

**Important:** local development can display a link once. In `NODE_ENV=production`, invitation/reset generation is deliberately disabled until a secure delivery provider is configured. **No email is currently sent.** Do not expose links in public logs or chat messages.

## API and security

- `GET /api/v1/auth/csrf`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/sessions`
- `POST /api/v1/auth/sessions/revoke`
- `POST /api/v1/auth/change-password`
- `POST /api/v1/auth/activate`
- `/api/v1/admin/*` — permission-controlled administration operations

State-changing JSON requests require an X-CSRF-Token and matching cookie. Sessions use server-side hashed tokens and HttpOnly SameSite=Strict cookies, Secure under HTTPS production. Session lifetime is 8 hours absolute or 30 minutes idle. All critical account actions are audited.

Password hashing uses memory-hard native scrypt. The user-requested six-character minimum is less resistant to guessing than a longer passphrase; recommend unique passwords or a password manager. MFA, compromised-password checks, secure recovery delivery, and independent security review are still required prior to public production deployment.

## Verification

GitHub Actions checks Prisma generation/migrations, bootstrap, TypeScript, build, and API integration tests including six-character activation, reset, current-password verification and session revocation.
