# Administration: Branches & Departments

This feature is implemented on `feature/administration-organization` from `GSpace-production`.

## Database and migration

- Additive migration: `20261112145000_administration_organization`.
- `Branch` now holds optional city and manager; `Department` can reference an optional lead.
- Existing records and employee memberships are preserved. No mock branches or departments are seeded.
- Run `npm run db:generate` and `npm run db:deploy -w @gspace/api` against the intended **development** database before starting the API. Back up data before applying any production migrations.

## API

Every organization endpoint requires an authenticated session and `users.manage`:

- `GET /api/v1/admin/organization`: live branch, department and active employee lookup records; response is branch-scoped for non-global readers.
- `POST /api/v1/admin/organization/branches`: register a branch with an immutable unique code.
- `PATCH /api/v1/admin/organization/branches/:branchId`: edit branch name, city, manager or active state.
- `POST /api/v1/admin/organization/departments`: register a department under an active branch.
- `PATCH /api/v1/admin/organization/departments/:departmentId`: edit department, branch, lead or active state.

Write operations additionally require the System Administrator or Company Administrator role. All requests use the existing CSRF protection and are audited in `SecurityAuditEvent`. Administrative UI uses the shared controls and confirmation pattern.

## Constraints

- Every employee belongs to one branch. A branch manager or department lead must be an active employee assigned to that same branch.
- Create a branch first; once employees are assigned to it, select its manager.
- Branch deactivation is refused if active users, active departments or any assets still reference it.
- Department deactivation retains members and historical records. Reassign members before moving a department to a different branch.
- When an employee is deactivated or transferred to a different branch through the Users API, any former manager/lead assignments are cleared within the same transaction and audited.
- Duplicate names are rejected case-insensitively by the organization API. The database additionally enforces the existing department key and unique branch code.

## Verification

GitHub Actions on the draft PR run PostgreSQL migrations, bootstrap, typechecks, builds and API integration tests. Manual UI checks should cover CRUD, inactive state, search, dependent branch/department selection, permissions and error messages.

**Do not merge until the owner explicitly approves the feature branch.**
