# GSpace — Resource Management System

GSpace is an internal enterprise resource-management application. This repository contains the starting architecture for the production app; the approved ResourceFlow design prototype remains the UX/UI reference.

## Stack

- **Web:** React, TypeScript, Vite, Tailwind CSS
- **API:** Node.js, TypeScript, Express
- **Database:** PostgreSQL and Prisma
- **Workspace:** npm workspaces (Node.js 22+)

## Quick start

1. Install Node.js 22+ and PostgreSQL 17 (or run `docker compose up -d db`).
2. Run `npm install` at the repository root.
3. Copy `apps/api/.env.example` to `apps/api/.env` and update `DATABASE_URL`.
4. Run `npm run db:generate` and `npm run db:migrate`.
5. Run `npm run dev` to start the web and API development servers.
6. Open `http://localhost:5173` (API health: `http://localhost:4000/api/health`).

**Implementation status:** Authentication, Administration Users/Roles/Organization, Resources, Assignments and Requests & Approvals are connected to PostgreSQL on the current development branch. Other modules still display illustrative data. The application is **not yet production-ready**; functionality, backups, notifications, remaining modules and security hardening are being completed incrementally.

## Repository layout

```text
apps/
  web/          React frontend
  api/          Express REST API and Prisma schema
docs/           Architecture and delivery milestones
compose.yml     Local PostgreSQL
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for boundaries, principles, and implementation order.

## Backend / Authentication foundation

See [docs/AUTH_FOUNDATION.md](docs/AUTH_FOUNDATION.md) for secure local initialization, PostgreSQL baseline migrations, first-administrator bootstrap, API endpoints, limitations and tests. The UI remains a prototype until each business module is implemented.

Approval workflow implementation and limitations: [docs/APPROVALS.md](docs/APPROVALS.md).
