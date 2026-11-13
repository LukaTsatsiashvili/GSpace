# Requests & Approvals — connected MVP

Feature: `feature/requests-approvals-backend` → Draft PR #18. **Do not merge without explicit owner approval.**

## Design

- Approval types have an immutable uppercase code, editable title/description/active state and numbered **append-only versions**.
- Each version stores an array of validated dynamic fields (text, number, date, select, multi_select) and ordered approval levels as JSON. New submissions capture the current version; editing the type never migrates submitted requests.
- Each level contains one or more **USER** or **ROLE** targets. A level can use `ANY` (one approval advances, remaining reviewers become skipped) or `ALL` (all must approve). Levels are executed sequentially. This supports mixed sequential/parallel configurations.
- A role target resolves to active users with `approvals.review` permission at submission time, in the request's branch. Targeted users must also have this permission. The requester is excluded (no self-approval). At least one eligible reviewer must exist per level.
- One request carries a permanent `REQ-00001`-style code, version reference, dynamic values, assigned reviewers, current level, immutable events and audit records.
- Decisions: approve, reject (terminal), request changes (requester may edit fields and resubmit), and requester cancel before completion. A resubmission restarts the same historical version at the first level; previous decisions remain in immutable `ApprovalEvent` history. All write operations and review-state transitions execute atomically with server-side checks in serializable transactions, with retries on serialization conflicts.
- Branch visibility, request ownership, reviewer assignment and permission checks are enforced on the API. Client-side navigation or hidden buttons are not a security control.

## Permissions

- `approvals.request`: submit and follow own requests (Employee, Branch Manager, Asset Manager, central administrators).
- `approvals.review`: act only on requests assigned to the authenticated user (Branch Manager, Asset Manager, central administrators).
- `approvals.configure`: create and revise request types (central administrators only).
- `reports.export`: CSV export of accessible, explicitly selected request IDs (max 200), recorded in `SecurityAuditEvent`.
- `audit.view`: read-only visibility according to actor and branch scope. New grants are seeded additively.

Note: At least one active branch reviewer must have the appropriate role grants for a new request to submit.

## Routes (all under /api/v1/approvals)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | /lookups | Authorized reviewer/user/role/branch lookups |
| GET | /types | Current type definitions; non-configurators see only active types |
| POST | /types | Create type and version 1 |
| PUT | /types/:id | Publish next version, retain historical snapshots |
| GET | / | Latest 200 accessible requests, with exact total/truncation indicator |
| POST | / | Submit a validated request |
| GET | /:id | Request details, assigned decisions and timeline |
| POST | /:id/decision | Assigned reviewer decision for current active level |
| POST | /:id/resubmit | Owner revises changes-requested request on original version |
| POST | /:id/cancel | Owner cancels active request |
| POST | /export/csv | Permission-checked, logged CSV of chosen accessible requests |

All writes require a valid authenticated session and CSRF token.

## Before testing

1. Back up the target development database.
2. On the feature branch run `npm ci`, `npm run db:generate`, `npm run db:deploy -w @gspace/api`, then `npm run dev`.
3. The additive migration provisions new approval permissions for existing standard roles. **Do not rerun the first-administrator bootstrap on an existing database** (it correctly refuses to run). Custom roles can be granted the new permissions using Administration → Roles.
4. Create a request type with actual reviewer users or roles in an active branch.
5. Sign in as a requester to submit; sign in as each reviewer to confirm `ANY` and `ALL` behavior, rejection, changes, resubmission, cancellation, immutable history and Export.
6. Test with a different branch, an unauthorised employee and changed role permissions before approval.

## Known limitations / later iterations

- Dynamic fields currently support text, number, date, single- and multi-select. File-upload fields, advanced regex validation and conditional form fields are deferred.
- No reminder scheduler, escalation queue, email/browser notifications, automatic downstream resource allocation or purchase execution; **approval alone makes no Resource/Finance changes**.
- Deadlines are currently *calendar days*, not configurable business-day/holiday schedules.
- First 200 records are shown; historical pagination is future work. The UI labels loaded-record KPI counts explicitly.
- Only current request/decision export is available (CSV); no PDF or XLSX report and no scheduled exports.
- Reviewers are snapshotted at submission and not reassigned automatically when employee roles or branches change. Future reassignment needs an auditable administrator workflow.
- The application still requires independent security review, backup/restore rehearsal, full end-to-end acceptance testing and operational monitoring before production deployment.
