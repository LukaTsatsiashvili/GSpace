# Organization structure (increment 1)
Feature branch: feature/organization-structure. Do not merge before owner approval.

## Model
BusinessUnit and Brand are independent normalized groups. A physical Branch belongs to one business unit and optionally one brand; stores require both. Branch kind OFFICE / STORE / WAREHOUSE / OTHER; LEGACY preserves unclassified historical rows. Departments are functional teams within a physical branch. No existing IDs, users, resources, approval or assignment history are automatically moved by the additive migration. Existing authorization continues to use branchId. STORE login, activation and session access require BRANCH_MANAGER; EMPLOYEE is directory-only everywhere. Central back-office roles must belong to a non-store location. Store manager role is verified when selecting a store's manager. Groups with active branches cannot be deactivated.

## Migration of existing Stores
1. Backup staging database. Apply migration and create Business Units (e.g. Head Office, Retail) and real brands in Administration > Branches.
2. Classify Head Office as OFFICE; create a distinct STORE branch for each actual shop with a unique immutable code and matching brand.
3. Existing Stores departments represent old locations, not functional teams. Inventory current users and resource asset codes per store. The database has no department foreign key on Resource, so do NOT infer resource location from department name or free text.
4. Close or explicitly reconcile any open assignment or request in the old umbrella branch before moving its affected employees/resources. Preserve completed historical records on their original IDs. Use Administration Users to move each employee to its verified new branch and choose department if applicable. Assign an active BRANCH_MANAGER as branch manager. For available/retired assets use audited resource edit to select the verified physical location; active custody must be reconciled first. Do not bulk update unknown locations.
5. After reconciling every user and asset, deactivate obsolete departments and the umbrella Stores branch if no longer in use. Do not classify umbrella Stores as a physical store.
6. Re-test branch-manager access and existing workflows. Transfer branch is deliberately separate; rebase or merge the approved organization branch into it only after owner acceptance, then add origin/destination group filters and test real store-to-store moves. No transfer validation bypass.

## Filters
Shared Business Unit / Brand / Branch cascade for Resources, Assignments, Requests & Approvals, Administration Users. Branch/department administration also filters groups. Filtering is client-side over already authorized loaded rows, not a new permission; existing record limits remain. No new backend or real data for remaining preview modules; use shared filter there as each module is connected. Existing unclassified rows remain visible with All filters. Server directory endpoint returns only branch metadata and restricts managers to own branch; cross-branch back-office reviewers can read directory metadata but not unrelated assets.

## Verification
npm ci; npm run db:generate; npm run db:deploy -w @gspace/api; npm run typecheck; npm run build; npm run test -w @gspace/api.
Create two stores of one brand and another brand, check cascading filters and CSV output selection. Check store employee cannot authenticate, non-manager roles rejected on user creation/edit, manager only sees own branch, head office roles unaffected. Check existing data and IDs remain unchanged. Check group deactivation is blocked with active branches and store classification blocked if incompatible active users exist. Perform staging migration mapping review before switching operational records.
