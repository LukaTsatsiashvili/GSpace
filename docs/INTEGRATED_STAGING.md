# Integrated staging acceptance
This branch combines organization structure and Transfers without merging production. Apply both additive migrations only to a backed-up staging database.
- Create units and brands; classify Head Office; create each real store as its own STORE branch. Only manager and employee membership is allowed there; only manager logs in.
- No automatic data reassignment. Legacy umbrella branches are excluded from new transfer selection until classified or replaced. Reconcile old custody and requests before moving people/assets, preserve history.
- Transfers can move between different physical store IDs even under the same brand. Source and destination filters use the shared organization directory; existing operational access checks stay in place.
- Run migrations, typecheck, build and tests. Test creation, role restrictions, branch isolation, approval, dispatch, partial receipt and export. Production remains unchanged.
