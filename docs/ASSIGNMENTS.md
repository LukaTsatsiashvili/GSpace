# Assignments: authenticated custody lifecycle (MVP)

Work branch: `feature/assignments-backend` (review in PR #17). Do **not** merge into `GSpace-production` without owner approval.

## Scope delivered

This stage converts the approved Assignments page from illustrative entries to PostgreSQL-backed records and audited API actions.

- Manager with `assignments.manage` issues 1–25 **AVAILABLE** assets to one active employee in the same active branch.
- All assets are conditionally reserved as `ASSIGNED` in one serializable transaction; the handover has a permanent `ASG-00001`-style ID.
- The recipient (not a manager acting as them) confirms each item separately: accept, report issue, or defer. Existing accepted/reported decisions cannot be overwritten.
- The recipient or authorized manager requests return of accepted/issue-reported items. Only an authorized manager verifies return, records condition, and makes the resource `AVAILABLE` again.
- Direct employee transfer of accepted items is supported within the same branch. The original item stays `TRANSFER_PENDING` until the receiving employee confirms. Rejected/unconfirmed transfers can be cancelled, restoring original custody; completed transfers leave immutable history.
- Each change writes `AssignmentEvent` and `SecurityAuditEvent`. Resource lifecycle status changes also create `ResourceAuditEvent` records. Resource deletion is rejected when historical assignment items exist.
- Receipt photo evidence may be attached (JPEG/PNG/WebP, up to 2 MiB, stored privately in PostgreSQL). For items whose issue condition is `Damaged`, or which are newly marked damaged by the recipient, a photo is mandatory when responding.
- Assignment listing, summary, current eligible resources, recipients and history now come from real API data. Empty states never substitute fictional records.
- Existing shared inputs, selectors, checkboxes, light/dark palette and global toast feedback remain in use.

## Routes

All paths begin with `/api/v1/assignments` and require authenticated sessions. Write operations also require the global matching CSRF token.

| Method | Route | Access |
| --- | --- | --- |
| GET | `/lookups` | Authenticated; write choices only for `assignments.manage` |
| GET | `/` | Current recipient's handovers, plus scoped manager records |
| GET | `/:assignmentId` | Recipient or scoped manager |
| GET | `/:assignmentId/items/:itemId/evidence` | Recipient or scoped manager; download private receipt photo |
| POST | `/` | Scoped `assignments.manage` |
| POST | `/:assignmentId/receipt` | Recipient only |
| POST | `/:assignmentId/returns/request` | Recipient or scoped manager |
| POST | `/:assignmentId/returns/verify` | Scoped `assignments.manage` |
| POST | `/:assignmentId/transfers` | Original custodian or scoped manager |
| POST | `/:assignmentId/transfers/cancel` | Receiving/original custodian or scoped manager |

## Status and integrity rules

**Resource status** changes from `AVAILABLE → ASSIGNED` at issue; receipt changes only item-level status. Resources become `AVAILABLE` only upon authorized verification, not when a return is requested. Direct transfers leave the resource `ASSIGNED`.

**Assignment item states:** `PENDING`, `ACCEPTED`, `ISSUE_REPORTED`, `RETURN_REQUESTED`, `RETURNED`, `TRANSFER_PENDING`, `TRANSFERRED`, `CANCELLED`.

All multi-item writes are transactional. Conditional updates, unique IDs, serializable isolation and retries prevent two simultaneous issuances or receipts from silently overwriting one another. A branch manager cannot issue outside their branch. Recipient confirmation is checked server-side.

## Deployment / validation

On a local **development** database only, first back up valuable data, then:

```bash
git fetch origin
git switch feature/assignments-backend
npm ci
npm run db:generate
npm run db:deploy -w @gspace/api
npm run dev
```

GitHub Actions tests Prisma migrations with disposable PostgreSQL 17, backend typechecking, frontend typechecking, builds, and integration tests. Never deploy this migration to a shared/production database before approval and a recoverable backup.

## Known limitations and next iterations

- Assignment CSV/PDF exports and printable, signed PDF handover forms are not implemented. The Export button reports this honestly.
- No in-app/email/browser notifications, due-date reminders, auto-escalation, or return/issue photo on the handover PDF yet. No automatic approval occurs.
- First 200 accessible assignments are shown; the UI identifies truncation. Full server-side pagination and exact all-record KPIs are future work.
- No cross-branch transfers in this module; those belong to the dedicated Transfers workflow.
- Receipt photos are downloadable by the involved recipient or authorized manager, but there is no inline image viewer or separate review dashboard yet.
- No independent production security assessment, backup/restore drill, or end-user acceptance test has been completed.
