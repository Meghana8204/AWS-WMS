import datetime
from decimal import Decimal
import uuid
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select, text

from app.main import app
from app.database.session import session_scope
from app.modules.procurement.infrastructure.persistence.models import (
    MaterialModel,
    MaterialStockModel,
    NotificationModel,
)
from app.modules.storage.infrastructure.persistence.models import (
    AssemblyRequisitionModel,
    AssemblyRequisitionItemModel,
    InventoryIssueTransactionModel,
    InventoryLocationBalanceModel,
    PickupTaskModel,
    PutawayTaskModel,
    StorageLocationModel,
)
from app.modules.store.infrastructure.persistence.models import (
    StoreManagerUserModel,
    StoreModel,
    StoreZoneModel,
)


@pytest.mark.asyncio
async def test_assembly_store_pickup_full_lifecycle_and_security():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # Seed test stores, zones, materials, and stock
        async with session_scope() as session:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            
            # 1. Stores: Mechanical Store (STR-002) and Electrical Store (STR-001)
            store_mech = await session.execute(select(StoreModel).where(StoreModel.store_code == "STR-002"))
            s_mech = store_mech.scalar_one_or_none()
            if not s_mech:
                s_mech = StoreModel(
                    id=uuid.uuid4(),
                    store_code="STR-002",
                    store_name="Mechanical Store",
                    warehouse_id="WH-001",
                    status="ACTIVE",
                )
                session.add(s_mech)
                await session.flush()

            store_elec = await session.execute(select(StoreModel).where(StoreModel.store_code == "STR-001"))
            s_elec = store_elec.scalar_one_or_none()
            if not s_elec:
                s_elec = StoreModel(
                    id=uuid.uuid4(),
                    store_code="STR-001",
                    store_name="Electrical Store",
                    warehouse_id="WH-001",
                    status="ACTIVE",
                )
                session.add(s_elec)
                await session.flush()

            # 2. Zones for each store
            zone_mech = await session.execute(select(StoreZoneModel).where(StoreZoneModel.zone_code == "Z-MECH-01"))
            z_mech = zone_mech.scalar_one_or_none()
            if not z_mech:
                z_mech = StoreZoneModel(
                    id=uuid.uuid4(),
                    store_id=s_mech.id,
                    zone_code="Z-MECH-01",
                    zone_name="Mechanical Zone 1",
                    status="ACTIVE",
                )
                session.add(z_mech)
                await session.flush()

            zone_elec = await session.execute(select(StoreZoneModel).where(StoreZoneModel.zone_code == "Z-ELEC-01"))
            z_elec = zone_elec.scalar_one_or_none()
            if not z_elec:
                z_elec = StoreZoneModel(
                    id=uuid.uuid4(),
                    store_id=s_elec.id,
                    zone_code="Z-ELEC-01",
                    zone_name="Electrical Zone 1",
                    status="ACTIVE",
                )
                session.add(z_elec)
                await session.flush()

            # 3. Storage Locations
            loc_mech_res = await session.execute(select(StorageLocationModel).where(StorageLocationModel.location_code == "LOC-MECH-01"))
            loc_mech = loc_mech_res.scalar_one_or_none()
            if not loc_mech:
                loc_mech = StorageLocationModel(
                    id=uuid.uuid4(),
                    location_code="LOC-MECH-01",
                    warehouse_id="WH-001",
                    store_id=s_mech.id,
                    zone_id=z_mech.id,
                    zone="Z-MECH-01",
                    rack="R1",
                    bin="B1",
                    capacity=Decimal("1000.0"),
                    occupied_quantity=Decimal("0.0"),
                    active=True,
                )
                session.add(loc_mech)
                await session.flush()

            # 4. Material and Stock
            mat_res = await session.execute(select(MaterialModel).where(MaterialModel.material_code == "MAT-MOTOR-001"))
            mat = mat_res.scalar_one_or_none()
            if not mat:
                mat = MaterialModel(
                    id=uuid.uuid4(),
                    material_code="MAT-MOTOR-001",
                    material_name="Servo Motor 500W",
                    category="MOTORS",
                    base_uom="PCS",
                    status="Active",
                )
                session.add(mat)
                await session.flush()

            stock_res = await session.execute(select(MaterialStockModel).where(MaterialStockModel.material_code == "MAT-MOTOR-001"))
            stock = stock_res.scalar_one_or_none()
            if not stock:
                stock = MaterialStockModel(
                    id=uuid.uuid4(),
                    material_id=mat.id,
                    material_code="MAT-MOTOR-001",
                    material_name="Servo Motor 500W",
                    category="MOTORS",
                    on_hand=Decimal("100.0"),
                    allocated=Decimal("0.0"),
                    available=Decimal("100.0"),
                    uom="PCS",
                    warehouse_id="WH-001",
                )
                session.add(stock)
            else:
                stock.on_hand = Decimal("100.0")
                stock.available = Decimal("100.0")

            # 4b. Seed GRN and Putaway Task for Foreign Key
            grn_id = uuid.uuid4()
            await session.execute(
                text("INSERT INTO grn (id, grn_number, warehouse_id, status) VALUES (:id, :grn_num, 'WH-001', 'GRN_POSTED') ON CONFLICT DO NOTHING"),
                {"id": grn_id, "grn_num": "GRN-INIT-001"}
            )
            await session.flush()

            pt_res = await session.execute(select(PutawayTaskModel).where(PutawayTaskModel.task_number == "PT-INIT-001"))
            pt = pt_res.scalar_one_or_none()
            if not pt:
                pt = PutawayTaskModel(
                    id=uuid.uuid4(),
                    task_number="PT-INIT-001",
                    grn_id=grn_id,
                    grn_number="GRN-INIT-001",
                    item_code="MAT-MOTOR-001",
                    material_name="Servo Motor 500W",
                    quantity=Decimal("100.0"),
                    uom="PCS",
                    warehouse_id="WH-001",
                    source_location="Dock 1",
                    status="COMPLETED",
                    created_by="system",
                    created_at=now_utc,
                )
                session.add(pt)
                await session.flush()

            # 5. Inventory Location Balance
            bal_res = await session.execute(
                select(InventoryLocationBalanceModel).where(
                    InventoryLocationBalanceModel.material_code == "MAT-MOTOR-001",
                    InventoryLocationBalanceModel.storage_location_id == loc_mech.id,
                )
            )
            bal = bal_res.scalar_one_or_none()
            if not bal:
                bal = InventoryLocationBalanceModel(
                    id=uuid.uuid4(),
                    material_code="MAT-MOTOR-001",
                    material_name="Servo Motor 500W",
                    warehouse_id="WH-001",
                    storage_location_id=loc_mech.id,
                    quantity=Decimal("100.0"),
                    available_quantity=Decimal("100.0"),
                    uom="PCS",
                    last_putaway_task_id=pt.id,
                    last_grn_number="GRN-INIT-001",
                    updated_at=now_utc,
                )
                session.add(bal)
            else:
                bal.quantity = Decimal("100.0")
                bal.available_quantity = Decimal("100.0")

            store_mech_id = s_mech.id
            store_elec_id = s_elec.id
            zone_mech_id = z_mech.id
            zone_elec_id = z_elec.id

        # Authentication headers
        assembly_headers = {"Authorization": "Bearer mock-jwt-assembly-token"}
        warehouse_headers = {"Authorization": "Bearer mock-jwt-warehouse-token"}
        store_keeper_mech_headers = {"Authorization": "Bearer mock-jwt-store-keeper-token"} # STR-002
        store_manager_elec_headers = {"Authorization": "Bearer mock-jwt-store-manager-token"} # STR-001

        # -------------------------------------------------------------
        # 1. Assembly Creates Assembly Material Requisition
        # -------------------------------------------------------------
        req_payload = {
            "warehouse_id": "WH-001",
            "department": "Assembly",
            "requested_by": "Assembly Operator 1",
            "priority": "HIGH",
            "required_date": (datetime.date.today() + datetime.timedelta(days=2)).isoformat(),
            "remarks": "Urgent motors required for Line 3 assembly",
            "items": [
                {
                    "material_code": "MAT-MOTOR-001",
                    "material_name": "Servo Motor 500W",
                    "quantity": 10.0,
                    "uom": "PCS",
                }
            ],
        }
        res_create = await client.post("/api/v1/assembly-requisitions", json=req_payload, headers=assembly_headers)
        assert res_create.status_code == 201, res_create.text
        created_data = res_create.json()
        req_number = created_data.get("requisition_number") or created_data.get("requisitionNumber")
        assert req_number.startswith("AR-")

        # -------------------------------------------------------------
        # 2. Assembly Views Own Requests
        # -------------------------------------------------------------
        res_list = await client.get("/api/v1/assembly-requisitions", headers=assembly_headers)
        assert res_list.status_code == 200
        ar_list = res_list.json()
        matching_ar = next((m for m in ar_list if (m.get("requisition_number") or m.get("requisitionNumber")) == req_number), None)
        assert matching_ar is not None
        ar_id = matching_ar["id"]
        assert matching_ar["status"] == "PENDING"
        assert (matching_ar.get("priority") or "MEDIUM") == "HIGH"
        assert matching_ar["department"] == "Assembly"

        # -------------------------------------------------------------
        # 3. Warehouse Views and Assigns Mechanical Store
        # -------------------------------------------------------------
        # Non-warehouse user cannot assign store
        res_fail_assign = await client.post(
            f"/api/v1/assembly-requisitions/{ar_id}/assign-store",
            json={"store_id": str(store_mech_id)},
            headers=assembly_headers,
        )
        assert res_fail_assign.status_code == 403

        # Warehouse assigns Mechanical Store
        res_assign = await client.post(
            f"/api/v1/assembly-requisitions/{ar_id}/assign-store",
            json={"store_id": str(store_mech_id)},
            headers=warehouse_headers,
        )
        assert res_assign.status_code == 200, res_assign.text
        assign_data = res_assign.json()
        assert assign_data["status"] == "success"
        assert assign_data["assigned_store"]["store_code"] == "STR-002"
        assert len(assign_data["tasks"]) == 1
        task_id = assign_data["tasks"][0]["id"]
        task_number = assign_data["tasks"][0]["task_number"]
        assert task_number.startswith("PCK-")

        # -------------------------------------------------------------
        # 4. Notifications Verification (Mechanical Store targeted)
        # -------------------------------------------------------------
        async with session_scope() as session:
            notif_res = await session.execute(
                select(NotificationModel).where(
                    NotificationModel.user_role == "STR:STR-002"
                )
            )
            notifs = notif_res.scalars().all()
            assert len(notifs) >= 1
            assert any(req_number in n.message for n in notifs)

            # Ensure Electrical Store STR:STR-001 did NOT get assigned notification
            elec_notif_res = await session.execute(
                select(NotificationModel).where(
                    NotificationModel.user_role == "STR:STR-001"
                )
            )
            elec_notifs = elec_notif_res.scalars().all()
            assert not any(req_number in n.message for n in elec_notifs)

        # -------------------------------------------------------------
        # 5. Store Keeper Scoped Task Listing
        # -------------------------------------------------------------
        # Mechanical Store Keeper sees the task
        res_sk_tasks = await client.get("/api/storage/pickup-tasks", headers=store_keeper_mech_headers)
        assert res_sk_tasks.status_code == 200
        mech_tasks = res_sk_tasks.json()
        assert any(t["id"] == task_id for t in mech_tasks)

        # Electrical Store Manager does NOT see Mechanical store task
        res_elec_tasks = await client.get("/api/storage/pickup-tasks", headers=store_manager_elec_headers)
        assert res_elec_tasks.status_code == 200
        elec_tasks = res_elec_tasks.json()
        assert not any(t["id"] == task_id for t in elec_tasks)

        # -------------------------------------------------------------
        # 6. IDOR Protection (Cross-Store Access Blocked)
        # -------------------------------------------------------------
        res_idor_get = await client.get(f"/api/storage/pickup-tasks/{task_id}", headers=store_manager_elec_headers)
        assert res_idor_get.status_code == 403

        res_idor_start = await client.post(f"/api/storage/pickup-tasks/{task_id}/start", headers=store_manager_elec_headers)
        assert res_idor_start.status_code == 403

        # -------------------------------------------------------------
        # 7. Start Pickup Task by Mechanical Store Keeper
        # -------------------------------------------------------------
        res_start = await client.post(f"/api/storage/pickup-tasks/{task_id}/start", headers=store_keeper_mech_headers)
        assert res_start.status_code == 200
        started_task = res_start.json()
        assert started_task["status"] == "PICKING"

        # -------------------------------------------------------------
        # 8. Physical Pick Validations (QR, Zone, Stock)
        # -------------------------------------------------------------
        # 8a. Wrong Material QR scan rejection
        res_wrong_mat = await client.post(
            f"/api/storage/pickup-tasks/{task_id}/complete",
            json={
                "material_scan": "MAT-WRONG-999",
                "zone_scan": "Z-MECH-01",
                "quantity": 10.0,
            },
            headers=store_keeper_mech_headers,
        )
        assert res_wrong_mat.status_code == 422
        assert "material" in res_wrong_mat.json()["detail"].lower()

        # 8b. Cross-Store Zone QR scan rejection
        res_wrong_zone = await client.post(
            f"/api/storage/pickup-tasks/{task_id}/complete",
            json={
                "material_scan": "MAT-MOTOR-001",
                "zone_scan": "Z-ELEC-01", # Belongs to STR-001, not STR-002
                "quantity": 10.0,
            },
            headers=store_keeper_mech_headers,
        )
        assert res_wrong_zone.status_code == 422
        assert "zone" in res_wrong_zone.json()["detail"].lower()

        # 8c. Excessive quantity rejection
        res_over_qty = await client.post(
            f"/api/storage/pickup-tasks/{task_id}/complete",
            json={
                "material_scan": "MAT-MOTOR-001",
                "zone_scan": "Z-MECH-01",
                "quantity": 9999.0,
            },
            headers=store_keeper_mech_headers,
        )
        assert res_over_qty.status_code == 422

        # -------------------------------------------------------------
        # 9. Successful Pick & Handover Confirmation
        # -------------------------------------------------------------
        res_complete = await client.post(
            f"/api/storage/pickup-tasks/{task_id}/complete",
            json={
                "material_scan": '{"material_code": "MAT-MOTOR-001", "batch": "B1"}',
                "zone_scan": "Z-MECH-01",
                "quantity": 10.0,
            },
            headers=store_keeper_mech_headers,
        )
        assert res_complete.status_code == 200, res_complete.text
        complete_data = res_complete.json()
        assert complete_data["status"] == "COMPLETED"
        assert complete_data["picked_quantity"] == 10.0
        assert complete_data["issue_number"].startswith("ISS-")
        assert complete_data["inventory_available_before"] == 100.0
        assert complete_data["inventory_available_after"] == 90.0

        # -------------------------------------------------------------
        # 10. Idempotency / Double Pick Prevention
        # -------------------------------------------------------------
        res_double_pick = await client.post(
            f"/api/storage/pickup-tasks/{task_id}/complete",
            json={
                "material_scan": "MAT-MOTOR-001",
                "zone_scan": "Z-MECH-01",
                "quantity": 10.0,
            },
            headers=store_keeper_mech_headers,
        )
        assert res_double_pick.status_code == 409

        # -------------------------------------------------------------
        # 11. Database Audit and Stock Verification
        # -------------------------------------------------------------
        async with session_scope() as session:
            # MaterialStock verification
            stock_check = await session.execute(
                select(MaterialStockModel).where(MaterialStockModel.material_code == "MAT-MOTOR-001")
            )
            s = stock_check.scalar_one()
            assert s.on_hand == Decimal("90.0")
            assert s.available == Decimal("90.0")

            # Outbound Issue Transaction Audit
            tx_check = await session.execute(
                select(InventoryIssueTransactionModel).where(
                    InventoryIssueTransactionModel.pickup_task_id == uuid.UUID(task_id)
                )
            )
            tx = tx_check.scalar_one_or_none()
            assert tx is not None
            assert tx.quantity == Decimal("10.0")
            assert tx.stock_before == Decimal("100.0")
            assert tx.stock_after == Decimal("90.0")
            assert tx.store_code == "STR-002"
            assert tx.zone_code == "Z-MECH-01"
            assert tx.recipient_department == "Assembly"

            # Assembly Requisition lifecycle
            ar_check = await session.execute(
                select(AssemblyRequisitionModel).where(AssemblyRequisitionModel.id == uuid.UUID(ar_id))
            )
            ar_final = ar_check.scalar_one()
            assert ar_final.status == "COMPLETED"
