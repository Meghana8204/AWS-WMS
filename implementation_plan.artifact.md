# Implementation Plan - 15. PURCHASE ORDER

Implement comprehensive Purchase Order (PO) management including backend domain models, persistence, application logic, API endpoints, and frontend UI for creation and details.

## Proposed Changes

### Backend - Procurement Module

#### [MODIFY] [purchase_order_item.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/domain/purchase_order_item.py)
- Add `unit_of_measure`, `discount`, and `tax` fields to `PurchaseOrderItem`.
- Update `line_total` calculation to account for discount and tax.

#### [MODIFY] [purchase_order.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/domain/purchase_order.py)
- Add `additional_charges` field to `PurchaseOrder`.
- Update summary properties (`subtotal`, `tax_amount`, `grand_total`) to correctly reflect line-item taxes, discounts, and additional charges.

#### [MODIFY] [models.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/persistence/models.py)
- Update `PurchaseOrderItemModel` (table `purchase_order_line`) with `unit_of_measure`, `discount`, `tax`.
- Update `PurchaseOrderModel` (table `purchase_order`) with `additional_charges`.

#### [MODIFY] [commands.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/application/commands.py)
- Update `OrderItemDTO` with new fields.
- Update `CreatePurchaseOrderCommand` and `UpdatePurchaseOrderCommand` with `additional_charges`.

#### [MODIFY] [use_cases.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/application/use_cases.py)
- Update use cases to propagate new fields from commands to domain objects.

#### [MODIFY] [schemas.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/api/schemas.py)
- Update Pydantic schemas for PO and items.

#### [MODIFY] [router.py](file:///D:/ams-wms-platform/ams-wms-platform/backend/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/api/router.py)
- Ensure endpoints handle the new fields correctly.

---

### Frontend

#### [MODIFY] [api-client.ts](file:///D:/ams-wms-platform/ams-wms-platform/frontend/src/lib/api-client.ts)
- Add `getPurchaseOrder(id: string)` to fetch a single PO's details.

#### [NEW] [procurement.new-po.tsx](file:///D:/ams-wms-platform/ams-wms-platform/frontend/src/routes/procurement.new-po.tsx)
- Implementation of the PO creation form with:
    - PO Information
    - Supplier Information (Auto-fetch from Supplier Master)
    - Order Items table with line-level details (Material, Qty, Price, Discount, Tax)
    - Delivery Details
    - Order Summary (Calculated totals)

#### [NEW] [procurement.po-detail.tsx](file:///D:/ams-wms-platform/ams-wms-platform/frontend/src/routes/procurement.po-detail.tsx)
- Implementation of the PO detail view showing all the information above.

#### [MODIFY] [procurement.purchase-orders.tsx](file:///D:/ams-wms-platform/ams-wms-platform/frontend/src/routes/procurement.purchase-orders.tsx)
- Link "Create Manual PO" to the new creation page.
- Link "Full Details" to the detail page.

## Verification Plan

### Automated Tests
- Backend: Run domain model unit tests to verify total calculations.
- Backend: Verify API endpoints with mock data.

### Manual Verification
1. Navigate to Purchase Order Dashboard.
2. Click "Create Manual PO".
3. Select a supplier (verify auto-fetch of supplier details).
4. Add items (verify line total and order summary calculations).
5. Save PO.
6. Verify PO appears in the list.
7. Click "Full Details" and verify all information is correctly displayed.
