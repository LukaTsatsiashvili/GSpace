# Resources backend and business rules

Feature branch: `feature/resources-backend`, based on `GSpace-production`. Pull Request #16 is **draft; do not merge without explicit approval**.

## Implemented in this increment

- PostgreSQL-backed Resources listing, live status counts, filtering, real detail view and responsive list/card layouts.
- Add Resource wizard writes a real record and returns a unique permanent `AST-00001`-style Asset ID. Resource creation is limited to central administrators with `assets.create`.
- Editable fields: category, resource type, condition, branch, location, serial number, notes, warranty, optional purchase metadata and category-specific custom attributes.
- Category definitions can be created/edited by authorized central administrators. Seeded standard categories include Laptop, Monitor, Mobile Device, Tablet, Printer, Network, POS Device and Other.
- Bulk Create supports 1–100 identical assets or a CSV import of 1–100 varied assets, validated transactionally on the server. **Direct XLSX upload is not supported**; export Excel as comma-delimited CSV. Each batch receives sequential unique IDs and an audit entry for every resource.
- Up to four attachments on *initial* resource creation: PDF, JPEG, PNG, WebP, CSV, TXT, DOCX or XLSX, maximum 2 MiB per file and 6 MiB total. Actual bytes are stored in PostgreSQL `BYTEA`, and downloads require authentication and branch authorization. Direct additional upload after registration is not yet implemented.
- Resource-specific immutable audit events record created/updated/deleted actions and actor. Security audit also records each write.
- Central administrators can delete only unused `AVAILABLE` or `RETIRED` resources. Audit events remain after a deletion.
- Status transitions tied to assignments, transfers and maintenance are deliberately **not editable** in Resources; those states belong to the later workflow modules.
- Financial values are returned only to `finance.view` users. Editors without `finance.edit` cannot change or erase them.
- A permission-checked, audited CSV export serves selected resource rows (maximum 500), with spreadsheet-formula escaping.

## CSV template and import

1. Open **Resources → Bulk create → CSV spreadsheet import**.
2. Choose **Download template**. The CSV is generated in the browser from the authenticated `/catalog` response; no fabricated branches or categories are written.
3. The file includes required columns `Name`, `Category`, `Branch`, `Condition`, optional asset details, permitted Finance columns, and a `custom.<fieldKey>` column for every currently configured category-specific field.
4. It starts with one sample row containing a **real active category and branch**. Complete the empty `Name` and all required custom fields for the selected category, or duplicate the row for additional assets.
5. In Excel, save back to **CSV UTF-8 (comma-delimited)**, then upload the same file. A batch accepts 1–100 records; all rows are validated on the backend before creation.

Template generation and parsing share a pure tested module. The CSV parser supports quoted values, commas, Georgian characters and protected formula-prefixed category/branch names. Exported records and uploaded templates are different features: resource export remains permission-controlled and audited.

## Shared notifications and Resources details UI

Successful operations and transient errors use the global `ToastProvider` / `useToast` component, including Administration. Toasts appear in the top-right, support manual dismissal, and auto-hide after a duration based on severity. Form field validation stays with the form instead of becoming a transient toast.

The Resource Details drawer separates General information, Custom specifications and Purchase information using consistent section spacing and light dividers. Its footer keeps Close on the left, and Delete unused beside Edit resource on the right. Documents and Audit timeline no longer repeat their tab titles inside the panels.

## API

All endpoints are under `/api/v1/resources`, use an authenticated session and an `assets.view` grant:

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Browse up to first 500 accessible resources + real summary |
| GET | `/catalog` | Active categories/definitions and authorized branches |
| GET | `/:resourceId` | Resource details |
| GET | `/:resourceId/audit` | Resource-specific audit history |
| GET | `/:resourceId/documents/:documentId` | Secure authenticated document download |
| POST | `/` | Create resource, with optional documents |
| PATCH | `/:resourceId` | Update an editable resource |
| DELETE | `/:resourceId` | Delete unused asset (central admins only) |
| POST | `/bulk` | Create identical resources (1–100) |
| POST | `/bulk/import` | Create individually validated resources (1–100) |
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

GitHub Actions runs Prisma migrations, admin bootstrap, API/Frontend TypeScript checks, builds and integration tests against a disposable PostgreSQL 17 instance. It also runs `npm run test:web-csv` to verify generated-template/import compatibility.

## Explicitly deferred

- Real Assignments, Transfers, Inventory, Maintenance and approval workflow transitions; their tabs intentionally show no fictional events.
- Full bundle membership linking, depreciation and GEL currency conversion, extra attachment upload after resource creation, direct XLSX import, pagination beyond the first 500 assets, and dedicated financial reporting.
- Public production readiness requires independent security and operational review, safe backups and deployment checks.
