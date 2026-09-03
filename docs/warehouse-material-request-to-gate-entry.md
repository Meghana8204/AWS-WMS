# Warehouse Material Request to Gate Entry Flow

## Scope

This document describes the inbound procurement flow from a warehouse material request until the supplier vehicle receives a gate-entry pass and is placed in the warehouse dock queue.

The material request does not create a gate entry directly. The inbound relationship is:

```text
Material Request -> RFQ -> Supplier Quotation -> PO Proposal -> Finance Approval -> ASN -> Gate Entry
```

## 1. Create the Material Request

A warehouse user submits a material request containing:

- Warehouse
- Department
- Requester
- Required date
- Material or material variant
- Quantity and UOM
- Remarks, if required

API:

```text
POST /api/procurement/material-requests
```

Processing performed by the service:

1. Generates or validates the material-request number.
2. Creates the request with status `PENDING`.
3. Validates that every requested quantity is greater than zero.
4. Resolves the material and variant, if supplied.
5. Rejects inactive materials or variants.
6. Ensures the selected variant belongs to the selected material.
7. Stores the request items in `material_request_item`.

Main implementation: `backend/business-service/app/modules/procurement/infrastructure/api/router.py`.

## 2. Process the Material Request

Procurement reviews the request and marks it for procurement processing.

API:

```text
POST /api/procurement/material-requests/{id}/process
```

Only a request in `PENDING` status can be processed. Its status changes to:

```text
PENDING -> PROCESSED
```

A processed request cannot be processed again, and completed, cancelled, or rejected requests cannot be edited.

## 3. Create and Send the RFQ

Procurement creates an RFQ using the material-request number as the reference. The RFQ contains:

- Warehouse and required delivery date
- Procurement officer
- Requested materials and quantities
- One or more suppliers
- Special requirements and remarks

API:

```text
POST /api/procurement/rfqs
```

The service stores the material-request reference on the RFQ as `material_request_number`. Each RFQ item carries the material, variant, quantity, UOM, warehouse, and required delivery date.

The RFQ is then sent to the selected suppliers. Suppliers submit quotations against the RFQ.

Typical progression:

```text
RFQ Created -> RFQ Sent -> Quotations Submitted
```

## 4. Select the Supplier and Create the PO Proposal

Procurement evaluates the quotations and selects a supplier.

API:

```text
POST /api/procurement/rfqs/{rfq_id}/select-supplier
```

The service then:

1. Closes the RFQ.
2. Records the selected supplier and selection reason.
3. Reads the original material request to obtain the department.
4. Calculates prices, discounts, tax, freight, and total amount.
5. Copies the RFQ items into PO items.
6. Creates a purchase-order proposal.
7. Adds a PO approval-history record.
8. Notifies Finance.

The proposal starts in:

```text
PENDING_FINANCE
```

At this stage, the PO number is a proposal number such as `PROP-YYYYMMDD-####`.

## 5. Finance Approves or Rejects the PO

Finance reviews the PO proposal.

Approval API:

```text
POST /api/procurement/purchase-orders/{id}/approve
```

On approval:

1. PO status changes to `APPROVED`.
2. A formal PO number is generated, for example `PO-2026-0001`.
3. Approval history is recorded.
4. Procurement is notified.
5. The supplier can prepare shipment details.

Normal path:

```text
PENDING_FINANCE -> APPROVED
```

Rejection API:

```text
POST /api/procurement/purchase-orders/{id}/reject
```

A rejection reason is mandatory. The rejected path is:

```text
PENDING_FINANCE -> REJECTED
```

## 6. Supplier Creates the ASN

After the PO is approved, the supplier submits an Advance Shipping Notice (ASN).

API:

```text
POST /api/procurement/asns
```

The ASN normally contains:

- ASN number
- PO ID and PO number
- Shipped material lines and quantities
- Vehicle number
- Driver name and contact
- Expected arrival time
- Shipment date
- Transporter
- Package count and package type
- Shipping method
- Supporting documents

The ASN is normally created with status `SUBMITTED`. When it is linked to a PO:

1. The PO status changes to `SHIPPED`.
2. PO history records the shipment.
3. Procurement receives a shipment notification.
4. Arrival information becomes available to warehouse and security.

Normal path:

```text
PO APPROVED -> ASN SUBMITTED -> PO SHIPPED
```

## 7. Vehicle Arrives at the Gate

Security creates the gate entry using the ASN or PO information. The request may be submitted as JSON or multipart form data.

API:

```text
POST /api/gate-entries
```

The gate-entry request can include:

- ASN number or ASN ID
- PO number
- Vehicle number or vehicle photo
- Driver name
- Supplier name
- Material description
- Total quantity
- PO document

If an ASN reference is supplied, the service looks up the ASN and uses its vehicle number, PO number, and shipment lines. The ASN is therefore the preferred link between the supplier shipment and the arriving vehicle.

## 8. OCR and PO Verification

The gate process may use OCR to read the PO document and vehicle recognition to identify the vehicle. The system compares the arrival information with the stored PO.

The verification checks these fields:

- PO number
- Supplier name
- Material description
- Quantity
- PO date
- Expected delivery date

The service also checks for an existing active gate entry for the same PO to prevent duplicate active arrivals.

Possible results include:

```text
PO_VERIFIED
FIELD_MISMATCH_DETECTED
MANUAL_VERIFICATION_REQUIRED
UNSCHEDULED_ARRIVAL
```

A mismatch or low-confidence result requires supervisor review.

## 9. Supervisor Gate Decision

A supervisor can approve, reject, or classify the arrival as unscheduled.

API:

```text
POST /api/gate-entries/{entry_id}/verify
```

Actions:

- `APPROVE`: authorizes the arrival for warehouse processing.
- `REJECT`: rejects the vehicle; a reason is required.
- `UNSCHEDULED_ARRIVAL`: records an arrival that could not be matched to a scheduled PO/ASN.

For a normal ASN-backed arrival, approval sets the ASN status to:

```text
GATE_ENTRY_APPROVED
```

The service also creates a warehouse notification and a dock-allocation request.

## 10. Gate Pass and Warehouse Queue

On gate approval, the system generates a gate-entry number in this format:

```text
GE-YYYYMMDD-XXXXXX
```

Example:

```text
GE-20260903-A8F32B
```

The gate entry stores:

- Gate-entry number
- Vehicle and driver details
- PO and ASN references
- Supplier and shipment information
- OCR result and mismatches
- PO document and vehicle-photo data
- Verification user and timestamps

The approved entry is moved into the warehouse inbound queue:

```text
GATE_ENTRY_APPROVED -> AWAITING_DOCK
```

Warehouse staff can then assign a dock. Dock assignment is outside the material-request-to-gate-entry boundary, but it begins with:

```text
POST /api/gate-entries/{entry_id}/assign-dock
```

## Complete Normal Status Flow

```text
Material Request: PENDING
        |
        v
Material Request: PROCESSED
        |
        v
RFQ: CREATED / SENT
        |
        v
Quotation: SUBMITTED
        |
        v
PO Proposal: PENDING_FINANCE
        |
        v
PO: APPROVED
        |
        v
ASN: SUBMITTED
        |
        v
PO: SHIPPED
        |
        v
Gate Entry: PO_VERIFIED or APPROVED
        |
        v
Gate Entry: GATE_ENTRY_APPROVED
        |
        v
Gate Entry: AWAITING_DOCK
```

## Exception Paths

### PO or ASN mismatch

```text
Gate Entry -> FIELD_MISMATCH_DETECTED -> MANUAL_VERIFICATION_REQUIRED
```

A supervisor can approve or reject the arrival after reviewing the differences.

### Unscheduled vehicle

A vehicle without a matching scheduled PO/ASN can be recorded as:

```text
UNSCHEDULED_ARRIVAL
```

The unscheduled gate-pass endpoint is:

```text
POST /api/gate-entries/unscheduled
```

This creates a gate-pass-only record and does not start the normal dock workflow.

### Rejected PO

```text
PO Proposal: PENDING_FINANCE -> REJECTED
```

A rejected PO cannot proceed to ASN submission or normal gate-entry verification.

## Important Boundary

There are two different material flows in the system:

1. **Inbound procurement flow:** material request -> RFQ -> PO -> ASN -> gate entry -> receiving.
2. **Outbound warehouse issue flow:** stock reservation -> pick task -> material issue.

Only the inbound procurement flow leads to a supplier vehicle gate entry. Stock reservation and material issue are separate warehouse operations and do not create a supplier gate entry.
