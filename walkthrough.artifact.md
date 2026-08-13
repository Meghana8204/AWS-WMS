# Walkthrough - Purchase Order & Advance Shipment Notice (ASN)

Implemented a complete Purchase Order management system, an official supplier notification workflow, and the Advance Shipment Notice (ASN) submission portal for suppliers.

## Backend Changes

### ASN Domain & Persistence
- **[ASN Domain](file:///D:/ams-wms-platform/ams-wms-platform/backend/business-service/app/modules/procurement/domain/asn.py)**: Added `shipment_date`, `driver_name`, and `driver_contact` to the ASN aggregate.
- **[Persistence Layer](file:///D:/ams-wms-platform/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/persistence/models.py)**: Updated `AsnModel` with new columns. Added auto-migration logic in `main.py` to ensure these columns are created on startup.
- **[ASN Number Generation](file:///D:/ams-wms-platform/ams-wms-platform/backend/business-service/app/modules/procurement/application/use_cases.py)**: Implemented `GetNextAsnNumberUseCase` to generate sequential numbers in the format `ASN-YYYY-XXXX`.

### API Enhancements
- **[ASN Endpoints](file:///D:/ams-wms-platform/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/api/router.py)**: Added `GET /asns/next-number` and updated `POST /asns` to handle the extended ASN data.
- **[Standardized Prefix](file:///D:/ams-wms-platform/ams-wms-platform/backend/business-service/app/modules/procurement/infrastructure/api/router.py)**: Ensured all procurement endpoints are under `/api/v1/procurement`.

---

## Frontend Changes

### ASN Creation Portal
- **[New ASN Route](file:///D:/ams-wms-platform/ams-wms-platform/frontend/src/routes/supplier.asns.new.tsx)**: Created a dedicated workspace for suppliers to submit ASNs.
    - **PO Integration**: Auto-populates line items from the referenced Purchase Order.
    - **Smart Defaults**: Automatically sets shipped quantities to ordered totals (adjustable by the supplier).
    - **Logistics Data**: Capture vehicle and driver details for warehouse arrival tracking.
    - **Auto-ASN ID**: Displays the officially generated ASN number in real-time.

### Supplier Dashboard
- **[Dashboard Links](file:///D:/ams-wms-platform/ams-wms-platform/frontend/src/routes/supplier-dashboard.tsx)**: Replaced generic "Prepare Shipment" links with deep-links to the new ASN creation page, passing PO context.

---

## Verification Results

### Automated Verification
- Verified ASN number sequence generation logic.
- Confirmed database auto-migration successfully adds missing columns to the `asn` table.

### Manual UI Flow
1. **Login** as a Supplier.
2. Navigate to **Purchase Orders** in the Supplier Portal.
3. Click **Prepare Shipment** on an active PO.
4. Verify the **ASN Number** is correctly formatted (e.g., `ASN-2026-0001`).
5. Set **Expected Arrival Date** and **Vehicle Number**.
6. **Submit ASN** and verify redirection to the dashboard with an updated shipping status.
