# Resources backend and business rules

Feature branch: `feature/resources-backend`, based on `GSpace-production`. Pull Request #16 is **draft; do not merge without explicit approval**.

## Implemented in this increment

- PostgreSQL-backed Resources listing, live status counts, filtering, real detail view and responsive list/card layouts.
- Add Resource wizard writes a real record and returns a unique permanent `AST-00001`-style Asset ID. Resource creation is limited to central administrators with `assets.create`.
- Editable fields: category, resource type, condition, branch, location, serial number, notes, warranty, optional purchase metadata and category-specific custom attributes.
- Category definitions can be created/edited by authorized central administrators. Seeded standard categories include Laptop, Monitor, Mobile Device, Tablet, Printer, Network, POS Device and Other.
- Bulk Create supports **1–100 identical assets**, created atomically in PostgreSQL with permanent unique Asset IDs and audited actions. Spreadsheet import and template download have been deliberately removed from the MVP.
- Documents can be uploaded during resource creation and added or deleted **at any later time** from either Resources → Details → Documents or Edit resource → Documents. Both existing-resource surfaces reuse the same shared document manager and authenticated API. PDF, JPEG, PNG, WebP, CSV, TXT, DOCX, XLSX are permitted; maximum 2 MiB per file, 4 files / 6 MiB per upload, 20 stored documents / 20 MiB combined per asset. All bytes remain in PostgreSQL `BYTEA`, not public storage; downloads are protected by authentication and branch scope.
- Resource-specific immutable audit events record created/updated/deleted actions and actor. Security audit also records each write.
- Central administrators can delete only unused `AVAILABLE` or `RETIRED` resources. Audit events remain after a deletion.
- Status transitions tied to assignments, transfers and maintenance are deliberately **not editable** in Resources; those states belong to the later workflow modules.
- Financial values are returned only to `finance.view` users. Editors without `finance.edit` cannot change or erase them.
- A permission-checked, audited CSV export serves selected resource rows (maximum 500), with spreadsheet-formula escaping.

## Identical-item Bulk Create and deferred Custom Fields

**Resources → Bulk create** now supports only **Multiple identical items**. An authorized administrator selects the shared asset name, category, active branch, condition and quantity (1–100), reviews the batch and registers each asset with a unique, permanent Asset ID in one transaction. There is no CSV upload or template, and the old CSV import API is removed.

A category can have required Custom Fields. **Bulk Create deliberately permits those fields to be blank at registration.** For example, an administrator can bulk-register five laptops and later enter each laptop's specific RAM, storage or CPU in **Resource details → Edit resource**. The UI identifies fields awaiting completion. Individual Create and Edit operations still require those fields before saving, so the exception applies **only to identical-item bulk registration**.

The usual validations for category, branch, quantity, condition, allowed Custom Field keys, permissions and financial values remain active. Once a resource is edited, required category fields must be complete.

**CSV Export is retained**: exporting existing assets remains a separate authorized, audited function.

## Shared notifications and Resources details UI

Successful operations and transient errors use the global `ToastProvider` / `useToast` component, including Administration. Toasts appear in the top-right, support manual dismissal, and auto-hide after a duration based on severity. Form field validation stays with the form instead of becoming a transient toast.

The Resource Details drawer separates General information, Custom specifications and Purchase information using consistent section spacing and light dividers. Its footer keeps Close on the left, and Delete unused beside Edit resource on the right. Documents and Audit timeline no longer repeat their tab titles inside the panels.

## Document lifecycle and audit

Documents can be added and removed independently of Resource Edit, including for assigned or in-maintenance resources. **No Resource PATCH is required** to upload an invoice after registration. This does not bypass Resource field-validation requirements because document changes do not alter other resource fields.

- **Upload:** authorized `assets.edit` users only, within their permitted branch; one atomic transaction saves 1–4 files, enforces total asset storage limits, updates asset timestamp and records one `DOCUMENT_ADDED` audit entry per file plus `RESOURCE_DOCUMENTS_ADDED` in Security Audit.
- **Delete:** users with `assets.edit` confirm removal from the shared UI; a transaction deletes the selected binary record, writes `DOCUMENT_DELETED` to the resource's durable audit history and `RESOURCE_DOCUMENT_DELETED` to Security Audit. The file itself is irreversibly removed while its file name/ID metadata persists in audit.
- **Download:** `assets.view` and branch scope; binary responses are attachment-only with content sniffing disabled. Audited document create/delete operations are visible from the asset's Audit Timeline.
- **UX:** Resource Details → Documents and Edit resource → Documents share one component and update the file list immediately after successful mutation. In Edit, document operations save immediately, independently of other unsaved form inputs. All actions use the common Toast notification system.

## API

All endpoints are under `/api/v1/resources`, use an authenticated session and an `assets.view` grant:

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Browse up to first 500 accessible resources + real summary |
| GET | `/catalog` | Active categories/definitions and authorized branches |
| GET | `/:resourceId` | Resource details |
| GET | `/:resourceId/audit` | Resource-specific audit history |
| GET | `/:resourceId/documents/:documentId` | Secure authenticated document download |
| POST | `/:resourceId/documents` | Add 1–4 files to an existing resource; requires `assets.edit` |
| DELETE | `/:resourceId/documents/:documentId` | Confirmed deletion of one document; requires `assets.edit` |
| POST | `/` | Create resource, with optional documents |
| PATCH | `/:resourceId` | Update an editable resource |
| DELETE | `/:resourceId` | Delete unused asset (central admins only) |
| POST | `/bulk` | Create identical resources (1–100) |
| POST | `/export` | Audited CSV export requiring `reports.export` |
| POST | `/categories` | Create a category and custom definitions |
| PATCH | `/categories/:categoryId` | Modify category and definitions |

Every POST/PATCH/DELETE request requires an existing CSRF cookie + matching `X-CSRF-Token` header and JSON body.

## Roles and scope

- Read: `assets.view` and authorized branch only, except global central administration.
- Create / bulk / category changes: `assets.create` plus `SYSTEM_ADMIN` or `COMPANY_ADMIN`.
- Update: `assets.edit`, subject to branch scope; no direct assignment/transfer/maintenance state modifications.
- Delete: central admin with `assets.edit`, with lifecycle restrictions.
- Export: `reports.export`, same branch restriction; all exports audited.
- Finance: `finance.view` to read financial data; `finance.edit` required to set it.

## Deployment and testing

Apply the additive migration on the **intended development database** first:

```bash
git fetch origin
git switch feature/resources-backend
npm ci
npm run db:generate
npm run db:deploy -w @gspace/api
npm run dev
```

The migration retains existing Resources and initializes the sequence using the highest existing `AST-...` code. It also seeds standard categories. Back up the database before applying migrations to any shared or production database.

GitHub Actions runs Prisma migrations, admin bootstrap, API/Frontend TypeScript checks, builds and integration tests against disposable PostgreSQL 17. Coverage includes registering a bulk batch with incomplete required Custom Fields and finishing those fields through Edit.

## Explicitly deferred

- Real Assignments, Transfers, Inventory, Maintenance and approval workflow transitions; their tabs intentionally show no fictional events.
- Full bundle membership linking, depreciation and GEL currency conversion, pagination beyond the first 500 assets, and dedicated financial reporting.
- Public production readiness requires independent security and operational review, safe backups and deployment checks.
