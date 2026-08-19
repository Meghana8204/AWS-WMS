# Implementation Plan: Remove Redundant Fields from RFQ Items

The user wants to remove `warehouse` and `Required Delivery Date` from the "Material Requirements" (items) section of the RFQ creation flow, as these are already present in the RFQ Metadata.

## Proposed Changes

### Backend: Procurement Module

#### [MODIFY] [commands.py](file:///D:/ams-wms-platform/backend/business-service/app/modules/procurement/application/commands.py)
- Make `required_delivery_date` and `warehouse` optional in `RfqItemCommand`.

#### [MODIFY] [rfq_item.py](file:///D:/ams-wms-platform/backend/business-service/app/modules/procurement/domain/rfq_item.py)
- Make `required_delivery_date` and `warehouse` optional in `RFQItem` domain class.

#### [MODIFY] [use_cases.py](file:///D:/ams-wms-platform/backend/business-service/app/modules/procurement/application/use_cases.py)
- In `CreateRfqUseCase`, fallback to RFQ-level `warehouse` and `required_delivery_date` when item-level fields are missing.

#### [MODIFY] [models.py](file:///D:/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/persistence/models.py)
- Make `required_delivery_date` and `warehouse` columns nullable in `RfqItemModel`.

### Frontend: Procurement RFQ Creation

#### [MODIFY] [procurement.new-rfq.tsx](file:///D:/ams-wms-platform/frontend/src/routes/procurement.new-rfq.tsx)
- Remove `warehouse` and `required_delivery_date` from initial item state and `addItem` function.
- Remove UI input fields for `warehouse` and `Required Delivery Date` from the item loop.
- Adjust grid layout to accommodate removed fields.

## Verification Plan

### Automated Tests
- Verify RFQ creation with missing item-level fields via backend unit tests (if available) or manual API calls.

### Manual Verification
- Go to "Create New RFQ" page.
- Verify that `Warehouse` and `Required Delivery Date` are no longer visible in each material item.
- Fill out the RFQ (ensure Metadata fields are filled).
- Submit the RFQ and verify it is created successfully.
- Check the created RFQ in the list/details view to ensure items have inherited the correct warehouse and delivery date.
