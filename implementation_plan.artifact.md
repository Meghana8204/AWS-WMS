# Implementation Plan - Remove Decimals from Quantities and Enforce Today's Date

This plan addresses two issues:
1.  **Remove Decimal Numbers from Quantities**: Ensuring all material quantities displayed in the application are integers (no decimal points), as requested.
2.  **Enforce Today's Date in Inputs**: Ensuring all date inputs in the application do not allow selecting dates before today.

## Proposed Changes

### [Component Name] Frontend Routes

#### [MODIFY] [warehouse.material-requests.tsx](file:///D:/ams-wms-platform/frontend/src/routes/warehouse.material-requests.tsx)
- Wrap `item.quantity` in `Math.floor()` in the material request card list view.

#### [MODIFY] [procurement.material-requests.tsx](file:///D:/ams-wms-platform/frontend/src/routes/procurement.material-requests.tsx)
- Wrap `item.quantity` in `Math.floor()` in the material request card list view.

#### [MODIFY] [finance.approvals.$approvalId.tsx](file:///D:/ams-wms-platform/frontend/src/routes/finance.approvals.$approvalId.tsx)
- Wrap `item.quantity` in `Math.floor()` in the PO items table.

#### [MODIFY] [finance.approvals.compare.$rfqId.tsx](file:///D:/ams-wms-platform/frontend/src/routes/finance.approvals.compare.$rfqId.tsx)
- Wrap `item.quantity` in `Math.floor()` in the comparison table.

#### [MODIFY] [gate-entry.tsx](file:///D:/ams-wms-platform/frontend/src/routes/gate-entry.tsx)
- Use `Math.floor()` when calculating total quantity and when displaying arrival line items.

#### [MODIFY] [procurement.rfqs.tsx](file:///D:/ams-wms-platform/frontend/src/routes/procurement.rfqs.tsx)
- Ensure all quantity displays use `Math.floor()`.

#### [MODIFY] [procurement.new-rfq.tsx](file:///D:/ams-wms-platform/frontend/src/routes/procurement.new-rfq.tsx)
- Add `min` attribute to `rfq_date` input to prevent selection of past dates (even if read-only).

## Verification Plan

### Manual Verification
- Navigate to **Warehouse -> Material Requests** and verify that quantities in the card list (badges) are integers (e.g., `500 PCS` instead of `500.0000 PCS`).
- Navigate to **Procurement -> Material Requests** and verify the same.
- Navigate to **Finance -> Approvals** and check PO details to ensure quantities are integers.
- Open any date input (e.g., "Required Delivery Date" in New RFQ) and verify that dates before today are disabled in the calendar picker.
