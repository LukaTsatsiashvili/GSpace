# GSpace architecture (foundation)

## Intended deployment

Browser → HTTPS reverse proxy → React web app and `/api` → Express API → PostgreSQL.

The API owns all authorization checks and writes. Frontend visibility of a button is **not** a permission check. The database is not exposed publicly. TLS and secrets are configured per environment.

## Module boundaries

1. **Identity / administration** — employees, one assigned role per user, organizations, branches, policy and permissions.
2. **Resource catalog** — asset categories, status, condition, locations, documents.
3. **Assignments / transfers** — custody transitions, per-item receipt confirmation and return requests.
4. **Requests / approvals** — configurable approval flows with explicit decisions.
5. **Inventory / maintenance** — stock checks, incidents, service history.
6. **Licenses / subscriptions** — seats, renewals and ownership.
7. **Finance** — acquisition costs, payments, expenses and depreciation.
8. **Reports / audit** — derived read models and immutable audit events.

## Shared practices

- Feature-oriented React UI backed by reusable layout, form, table and modal components.
- Versioned REST endpoints under `/api/v1` once feature APIs are introduced.
- Server-side input validation and explicit error contracts for all write routes.
- Database transactions for multi-record business transitions.
- Audit records written atomically with sensitive business changes.
- Role- and branch-scoped access enforced on every API read and write.
- Consistent Light / Dark design tokens from the approved UX/UI reference.
- Tests for permission boundaries, workflow states and data integrity before production.

## Foundation scope

This first commit contains the monorepo, running web/API starter, Prisma connectivity scaffolding, a minimum identity/resource database draft and documentation. It does **not** imply final approval of business data fields, authentication mechanism, or workflows. The Prisma model is a starting point and can be expanded through reviewed migrations.

## Build order

1. Foundation and environment verification.
2. Auth, sessions, role permissions and audit base.
3. Application shell and reusable components, matching approved design.
4. Resource catalog CRUD and file attachment policy.
5. Assignments, transfers and receipt confirmations.
6. Requests, approvals and inventory.
7. Licenses, maintenance and finance.
8. Reports, diagnostics, hardening, backups and production deployment.
