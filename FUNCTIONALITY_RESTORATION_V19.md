# CarePoint V19 - Admin Payments + Refunds Functional Redesign

## Base
This delivery continues from V18 and keeps the restored V6 functional baseline as the authority for behavior. V19 only applies the modern design layer to Admin finance modules.

## Admin routes updated
- `/portal/payments/reconciliation`
- `/portal/payments/reconciliation/[batchId]`
- `/portal/payments/refunds`
- `/portal/payments/refunds/[caseId]`

## Functionality preserved
- `loadIntegratedPaymentsWorkspace()`
- `loadIntegratedRefundWorkspace()`
- `SettlementTable`
- `RefundCasesTable`
- `PaymentAdminActions`
- `RefundAdminActions`
- payment hold / release hold / settle actions
- refund action recording
- reconciliation batch detail drilldown
- refund case detail drilldown
- live API / fallback behavior through `DataSourceBanner`
- existing Admin route structure without replacing pages with redirects

## Design changes applied
- Modern finance command-center layout for reconciliation.
- Modern refund queue layout with evidence posture cards.
- V19 KPI lane cards for cleared / pending / mismatch and evidence states.
- Modernized table surfaces for settlement and refund queues.
- Modernized API action cards while keeping the same client-side API calls.
- Detail pages wrapped in the new V19 finance design layer without changing their data loaders or decision controls.

## Validation
- `npm run build` executed inside `apps/admin`.
- Build result: successful.
- Route inventory saved at `validation/v19/admin_route_files_v19.txt`.
