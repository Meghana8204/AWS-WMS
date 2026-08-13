"""
Integration tests for Gate Entry REST API endpoints.
"""
from __future__ import annotations

from decimal import Decimal
import io
import uuid
from typing import AsyncGenerator
import pytest
from fastapi import Header, HTTPException, status
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from app.database.base import Base
from app.database.session import UnitOfWork, get_uow
from app.main import app
from app.modules.gate.infrastructure.persistence.models import GateEntryModel, GateEntryAuditLogModel
from app.modules.receiving.infrastructure.persistence.models import PurchaseOrderModel, PurchaseOrderLineModel
from app.security.dependencies import CurrentUser, get_current_user

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class InMemoryUnitOfWork(UnitOfWork):
    def __init__(self) -> None:
        super().__init__()

    async def __aenter__(self) -> "InMemoryUnitOfWork":
        self.session = TestingSessionLocal()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        assert self.session is not None
        try:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
        finally:
            await self.session.close()


async def override_get_uow() -> AsyncGenerator[InMemoryUnitOfWork, None]:
    async with InMemoryUnitOfWork() as uow:
        yield uow


app.dependency_overrides[get_uow] = override_get_uow


_mock_user_context: dict[str, CurrentUser] = {}


async def override_get_current_user(authorization: str | None = Header(None)) -> CurrentUser:
    if authorization and authorization in _mock_user_context:
        return _mock_user_context[authorization]
    if "default" in _mock_user_context:
        return _mock_user_context["default"]
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing test token")


app.dependency_overrides[get_current_user] = override_get_current_user


@pytest.fixture(autouse=True)
async def setup_test_db() -> AsyncGenerator[None, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestingSessionLocal() as session:
        po_id = uuid.UUID("11111111-1111-1111-1111-111111111111")
        line_id = uuid.UUID("22222222-2222-2222-2222-222222222222")

        po = PurchaseOrderModel(
            id=po_id,
            po_number="PO-1001",
            supplier_name="Acme Corp",
        )
        line = PurchaseOrderLineModel(
            id=line_id,
            purchase_order_id=po_id,
            item_code="ITEM-A",
            ordered_quantity=Decimal("100.0"),
        )
        session.add(po)
        session.add(line)
        await session.commit()

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


def set_test_user(username: str, permissions: list[str], token_key: str = "default") -> dict[str, str]:
    _mock_user_context[f"Bearer {token_key}"] = CurrentUser(
        subject=username,
        username=username,
        roles=["SECURITY_OFFICER"],
        permissions=permissions,
        raw_claims={},
    )
    return {"Authorization": f"Bearer {token_key}"}


@pytest.mark.asyncio
async def test_create_gate_entry_full_flow():
    headers = set_test_user(
        username="sec_officer_bob",
        permissions=["gate:entry:create", "gate:entry:read"],
        token_key="token_bob",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        files = {
            "driver_photo": ("driver.jpg", io.BytesIO(b"fake_driver_photo_bytes"), "image/jpeg"),
            "po_document": ("po_1001.pdf", io.BytesIO(b"PO-1001 invoice text document"), "application/pdf"),
        }
        data = {
            "po_number": "PO-1001",
            "vehicle_number": "KA-01-AB-1234",
            "driver_name": "Bob Driver",
            "driver_license_number": "DL-98765",
            "driver_phone": "+1234567890",
        }

        response = await ac.post("/api/gate-entries", data=data, files=files, headers=headers)
        assert response.status_code == 201
        res_json = response.json()

        assert res_json["po_number"] == "PO-1001"
        assert res_json["vehicle_number"] == "KA-01-AB-1234"
        assert res_json["driver_name"] == "Bob Driver"
        assert res_json["security_officer_id"] == "sec_officer_bob"
        assert res_json["status"] in ("PO_VERIFIED", "MANUAL_VERIFICATION_REQUIRED")

        entry_id = res_json["id"]

        # Fetch detail
        get_res = await ac.get(f"/api/gate-entries/{entry_id}", headers=headers)
        assert get_res.status_code == 200
        assert get_res.json()["id"] == entry_id


@pytest.mark.asyncio
async def test_create_gate_entry_with_vehicle_photo():
    headers = set_test_user(
        username="sec_officer_bob",
        permissions=["gate:entry:create", "gate:entry:read"],
        token_key="token_truck_photo",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        files = {
            "driver_photo": ("driver.jpg", io.BytesIO(b"fake_driver_photo_bytes"), "image/jpeg"),
            "po_document": ("po_1001.pdf", io.BytesIO(b"PO-1001 invoice text document"), "application/pdf"),
            "vehicle_photo": ("truck_front.jpg", io.BytesIO(b"fake_truck_photo_bytes"), "image/jpeg"),
        }
        data = {
            "po_number": "PO-1001",
            "vehicle_number": "KA-05-MH-9999",
            "driver_name": "Trucker Joe",
        }

        response = await ac.post("/api/gate-entries", data=data, files=files, headers=headers)
        assert response.status_code == 201
        res_json = response.json()

        assert res_json["vehicle_photo_path"] is not None
        assert "vehicle_photos" in res_json["vehicle_photo_path"]


@pytest.mark.asyncio
async def test_create_gate_entry_automated_anpr_ocr_flow():
    """Verify security officer can submit photos only without filling text fields."""
    headers = set_test_user(
        username="sec_officer_bob",
        permissions=["gate:entry:create", "gate:entry:read"],
        token_key="token_auto_flow",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        files = {
            "driver_photo": ("driver.jpg", io.BytesIO(b"fake_driver_photo_bytes"), "image/jpeg"),
            "po_document": ("po_1001.pdf", io.BytesIO(b"PO-1001 invoice text document"), "application/pdf"),
            "vehicle_photo": ("truck_front.jpg", io.BytesIO(b"KA-05-MH-9999"), "image/jpeg"),
        }
        # Notice: NO text form data provided! Security officer only captures/uploads photos!

        response = await ac.post("/api/gate-entries", files=files, headers=headers)
        assert response.status_code == 201
        res_json = response.json()

        # Check that ANPR auto-extracted license plate and OCR auto-extracted PO number
        assert res_json["po_number"] == "PO-1001"
        assert res_json["vehicle_number"] == "KA-01-AB-1234"
        assert res_json["vehicle_photo_path"] is not None




@pytest.mark.asyncio
async def test_duplicate_gate_entry_rejection():
    headers = set_test_user(
        username="sec_officer_bob",
        permissions=["gate:entry:create"],
        token_key="token_dup",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        files = {
            "driver_photo": ("driver.jpg", io.BytesIO(b"driver_photo_bytes"), "image/jpeg"),
            "po_document": ("po_doc.pdf", io.BytesIO(b"po document content"), "application/pdf"),
        }
        data = {
            "po_number": "PO-1001",
            "vehicle_number": "KA-01-XY-9999",
            "driver_name": "Charlie Driver",
        }

        res1 = await ac.post("/api/gate-entries", data=data, files=files, headers=headers)
        assert res1.status_code == 201

        # Second attempt for same active PO & vehicle
        files2 = {
            "driver_photo": ("driver2.jpg", io.BytesIO(b"driver2_photo_bytes"), "image/jpeg"),
            "po_document": ("po_doc2.pdf", io.BytesIO(b"po document content 2"), "application/pdf"),
        }
        res2 = await ac.post("/api/gate-entries", data=data, files=files2, headers=headers)
        assert res2.status_code in (400, 409)


@pytest.mark.asyncio
async def test_manual_verification_workflow():
    sec_headers = set_test_user(
        username="sec_officer_bob",
        permissions=["gate:entry:create", "gate:entry:read"],
        token_key="token_sec",
    )

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Create an entry for PO not in database (UNSCHEDULED_ARRIVAL)
        files = {
            "driver_photo": ("driver.jpg", io.BytesIO(b"photo"), "image/jpeg"),
            "po_document": ("unscheduled_po.pdf", io.BytesIO(b"PO-9999 text content"), "application/pdf"),
        }
        data = {
            "po_number": "PO-9999",
            "vehicle_number": "MH-12-CD-5678",
            "driver_name": "Dave Driver",
        }

        res = await ac.post("/api/gate-entries", data=data, files=files, headers=sec_headers)
        assert res.status_code == 201
        entry_id = res.json()["id"]
        assert res.json()["status"] == "UNSCHEDULED_ARRIVAL"

        sup_headers = set_test_user(
            username="supervisor_alice",
            permissions=["gate:entry:verify", "gate:entry:read"],
            token_key="token_sup",
        )

        verify_res = await ac.post(
            f"/api/gate-entries/{entry_id}/verify",
            json={"approved": True, "notes": "Unscheduled delivery approved by warehouse supervisor"},
            headers=sup_headers,
        )
        assert verify_res.status_code == 200
        assert verify_res.json()["status"] == "APPROVED"
        assert verify_res.json()["verified_by_user_id"] == "supervisor_alice"


@pytest.mark.asyncio
async def test_unauthorized_access_rbac():
    no_perm_headers = set_test_user(username="regular_user", permissions=[], token_key="token_noperm")

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        files = {
            "driver_photo": ("driver.jpg", io.BytesIO(b"photo"), "image/jpeg"),
            "po_document": ("po.pdf", io.BytesIO(b"doc"), "application/pdf"),
        }
        data = {
            "po_number": "PO-1001",
            "vehicle_number": "KA-01-AB-1234",
            "driver_name": "Test Driver",
        }
        res = await ac.post("/api/gate-entries", data=data, files=files, headers=no_perm_headers)
        assert res.status_code == 403
