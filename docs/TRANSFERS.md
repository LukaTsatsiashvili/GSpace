# Branch Transfers MVP

Feature branch only; do not merge without explicit approval.

- Available assets are reserved as IN_TRANSFER in a serializable transaction. Source branch stays unchanged until each item is accepted. Assignments cannot use reserved assets; Resources cannot edit them or delete historical transfer assets.
- Manager approval: a separate authorized back-office user approves or rejects. Direct dispatch is restricted to back-office roles with transfers.manage. Source-scoped managers dispatch; destination-scoped recipient/manager confirms arrival and receipt. Central administrators retain global scope. Employee cannot log in.
- Cancellation/rejection before dispatch releases reservations. After dispatch no direct cancellation. Partial receipt updates only accepted assets, clears previous room/location and leaves unresolved items reserved. Report issue requires notes; damage requires private photo evidence. Resolve an issue through acceptance and a resolution note. Physical return/dispute escalation beyond acceptance is deferred.
- CSV export is authorized and audited. List and dashboard counts cover up to 200 loaded records. No automatic reminders, PDF, or notifications beyond local toast.

## Staging verification

Back up staging DB before migration. Run npm ci, npm run db:generate, npm run db:deploy -w @gspace/api, npm run typecheck, npm run build, npm run test -w @gspace/api, npm run dev.

Test two active branches and authorized managers, independent approval, direct dispatch, cancellation, concurrent assignment/transfer reservation, arrival, partial receipt, damage photo and resolution, resource branch update, unauthorized access, CSV and historical deletion rejection. Do not deploy production before acceptance.
