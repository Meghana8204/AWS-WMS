# Walkthrough: Simplified RFQ Material Requirements

I have removed the redundant `warehouse` and `Required Delivery Date` fields from the individual material requirements in the RFQ creation flow. These items now inherit their values from the RFQ-level metadata by default.

## Changes

### Backend
- **Domain & Commands**: Updated `RFQItem` and `RfqItemCommand` to make `warehouse` and `required_delivery_date` optional.
- **Use Case**: Modified `CreateRfqUseCase` to automatically apply the RFQ-level warehouse and delivery date to any items where they aren't explicitly provided.
- **Persistence**: Updated `RfqItemModel` to allow these columns to be nullable in the database.

### Frontend
- **RFQ Creation UI**: Removed the input fields for "Warehouse" and "Required Delivery Date" from each item in the "Material Requirements" section of the `procurement/new-rfq` page.
- **State Management**: Updated the initial state and logic for adding new items or auto-filling from a Material Request to exclude these redundant fields.

## Verification

### Manual Verification
1. Navigate to **Procurement > Create New RFQ**.
2. Observe that the "Material Requirements" section no longer shows individual warehouse or delivery date inputs.
3. Fill out the **RFQ Metadata** (including Warehouse and Required Delivery Date).
4. Add items to the list.
5. Submit the RFQ.
6. Verify that the created RFQ correctly reflects the chosen warehouse and delivery date for all its items.
