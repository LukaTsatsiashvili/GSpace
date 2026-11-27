# Requests & Approvals — connected MVP

Feature: `feature/requests-approvals-backend` → Draft PR #18. **Do not merge without explicit owner approval.**

## Design

- Approval types have an immutable uppercase code, editable title/description/active state and numbered **append-only versions**.
- Each version stores an array of validated dynamic fields (text, number, date, select, multi_select) and ordered approval levels as JSON. New submissions capture the current version; editing the type never migrates submitted requests.
- Each level contains one or more **USER** or **ROLE** targets. A level can use `ANY` (one approval advances, remaining reviewers become skipped) or `ALL` (all must approve). Levels are executed sequentially. This supports mixed sequential/parallel configurations.
- A role target resolves to active back-office users with `approvals.review` permission, **across branches**. Employee and Branch Manager roles are excluded even if assigned that permission by mistake. The requester is excluded (no self-approval). At least one eligible reviewer must exist per level.
- One request carries a permanent `REQ-00001`-style code, version reference, dynamic values, assigned reviewers, current level, immutable events and audit records.
- Decisions: approve, reject (terminal), request changes (requester may edit fields and resubmit), and requester cancel before completion. A resubmission restarts the same historical version at the first level; previous decisions remain in immutable `ApprovalEvent` history. All write operations and review-state transitions execute atomically with server-side checks in serializable transactions, with retries on serialization conflicts.
- Branch visibility, request ownership, reviewer assignment and permission checks are enforced on the API. Client-side navigation or hidden buttons are not a security control.

## Permissions

- `approvals.request`: submit and follow own requests (Branch Manager, Asset Manager and central administrators). **Employee is a non-login resource-custodian record**.
- `approvals.review`: act only on requests assigned to the authenticated back-office user (Asset Manager and central administrators; not Branch Manager or Employee).
- `approvals.configure`: create and revise request types (central administrators only).
- `reports.export`: CSV export of accessible, explicitly selected request IDs (max 200), recorded in `SecurityAuditEvent`.
- `audit.view`: read-only visibility according to actor and branch scope. New grants are seeded additively.

Note: At least one eligible active back-office reviewer must be available per step; reviewers are independent of the request branch.

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
3. The migration removes Employee role permissions and Branch Manager review permissions, while preserving legitimate back-office reviewer grants. **Do not rerun the first-administrator bootstrap on an existing database** (it correctly refuses to run). Custom roles can be granted the new permissions using Administration → Roles.
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

## Branch-to-back-office operational scenario (current feature branch)

- Employees do not log in. This is enforced at login, activation, and session validation even if a legacy credential exists. Creating an Employee record does not issue an invitation; requesting a password reset for an Employee is prohibited.
- A store Branch Manager creates the request in their branch, optionally selects an active Employee in that same branch (Requested for), and sends it to back-office reviewers in any branch.
- A request type may require a Requested-for Employee. This setting is **versioned**, so previously submitted requests keep their original rule.
- Requester and beneficiary are distinct database relations. The manager is the authenticated requester; the employee is the intended resource custodian.
- Managers may not approve requests, even if their role is accidentally granted reviewer permission. Back-office reviewers must be active, permissioned, and not be the requester.
- Approval alone does not allocate the resource. The physical handover remains a separate Assignments workflow.
- In Assignments, an authorized manager may use Record handover to document the receipt of resources for a non-login Employee. This requires an explicit on-behalf-of flag, a note of at least ten characters, and existing damage evidence rules. Events include the manager actor, the actual recipient, confirmation method and note. The UI distinguishes manager-witnessed handover from employee electronic acknowledgement.
- **Important evidentiary limitation:** A manager-recorded handover does not prove independent employee consent. PDF acknowledgement/signature and stronger evidence requirements remain a future enhancement.

## Testing this scenario

1. Test that Employee cannot log in or activate an old link; old sessions are rejected. Employee should still appear as an active resource-custody directory record.
2. Create a Request Type with a back-office USER or ROLE reviewer, require Requested-for Employee, and do not select Branch Manager/Employee approvers.
3. Submit as Branch Manager for an Employee in the same branch. Confirm missing or wrong-branch Employee is rejected.
4. Log in as a back-office reviewer from a different branch and approve. Confirm Branch Manager cannot decide.
5. Test ANY and ALL levels, request changes and resubmission, rejection, version changes, timeline and CSV export.
6. Assign assets to Employee, then record their physical handover as manager. Check mandatory note, damage-photo requirements and recorded custodian/manager in the timeline.
