# Auto-Generate Gate Entry Pass

This plan implements automatic gate pass generation after a gate entry is successfully created. A printable pass (in HTML/PDF format) will be automatically downloaded for the user, and a manual print option will be added to the live queue.

## User Review Required

> [!NOTE]
> The "PDF" generated is currently a printable HTML document served with a PDF mime-type. This allows the browser to trigger a download and use its built-in print functionality. If a true binary PDF (e.g., using WeasyPrint or reportlab) is required, additional backend dependencies would need to be installed.

## Proposed Changes

### Backend (Gate Module)

#### [NEW] [pdf_service.py](file:///D:/ams-wms-platform/backend/business-service/app/modules/gate/application/pdf_service.py)
- Create `GatePassPdfGenerator` to render a professional, printable gate pass template.
- Include details: Gate Pass Number, Vehicle Plate, PO Number, Supplier, Material, and Quantity.

#### [MODIFY] [router.py](file:///D:/ams-wms-platform/backend/business-service/app/modules/gate/infrastructure/api/router.py)
- Add GET `/api/gate-entries/{entry_id}/pass` endpoint to generate and download the gate pass.
- Ensure the endpoint is protected by appropriate permissions (`gate:read`).

### Frontend

#### [MODIFY] [api-client.ts](file:///D:/ams-wms-platform/frontend/src/lib/api-client.ts)
- Implement `downloadGatePass(id, gateEntryNumber)` to fetch the pass from the backend and trigger a browser download.

#### [MODIFY] [gate-entry.tsx](file:///D:/ams-wms-platform/frontend/src/routes/gate-entry.tsx)
- Update the `submit` handler to call `api.downloadGatePass` immediately after successful creation.
- Add a `Printer` icon button to each entry in the "Live gate queue" for manual re-printing.
- Update `GateEntryRecord` type to include `gate_entry_number`.

## Verification Plan

### Automated Tests
- Verify that the `/api/gate-entries/{id}/pass` endpoint returns content when a valid ID is provided.

### Manual Verification
1. Open the "Gate Entry" page.
2. Fill in the details (Scan PO or enter manually).
3. Click "Create gate entry".
4. Observe that a PDF/HTML file named `GatePass-GE-YYYYMMDD-XXXXXX.pdf` is automatically downloaded.
5. Open the downloaded file and verify the layout and data.
6. Check the "Live gate queue" and click the printer icon on an entry to verify manual download.
