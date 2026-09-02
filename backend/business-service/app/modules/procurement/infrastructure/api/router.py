"""
Inbound API adapter for procurement module.
Purchase Order module has been removed.
"""
from __future__ import annotations

import os
import asyncio
import uuid
from io import BytesIO
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from xml.sax.saxutils import escape

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from reportlab.lib import colors
from reportlab.lib.enums import TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import or_, select, cast, String, update, func, Date
from sqlalchemy.orm import aliased, selectinload, joinedload

from app.common.domain.exceptions import NotFoundException
from app.logging.logger import get_logger

from app.database.session import UnitOfWork, get_uow
from app.modules.procurement.application.commands import (
    AddressCommand,
    BankInfoCommand,
    ContactCommand,
    CreateSupplierCommand,
    DocumentCommand,
    CreateRfqCommand,
    RfqItemCommand,
    SubmitQuotationCommand,
    QuotationLineCommand,
    QuotationDocumentCommand,
    UpdateSupplierCommand,
    CreateAsnCommand,
    AsnLineCommand,
    AsnDocumentCommand,
)
from app.modules.procurement.application.use_cases import (
    CreateSupplierUseCase,
    GetSupplierUseCase,
    ListSuppliersUseCase,
    UpdateSupplierUseCase,
    BlockSupplierUseCase,
    UnblockSupplierUseCase,
    CreateRfqUseCase,
    SendRfqUseCase,
    SubmitQuotationUseCase,
    CreateAsnUseCase,
    GetNextAsnNumberUseCase,
    GetNextMaterialRequestNumberUseCase,
)
from app.modules.procurement.domain.value_objects import (
    SupplierId,
    RfqId,
    QuotationId,
    AsnId,
)
from app.modules.procurement.infrastructure.api.schemas import (
    AddressRequest,
    BankInfoRequest,
    ContactRequest,
    CreateSupplierRequest,
    UpdateSupplierRequest,
    DocumentRequest,
    MasterDataCreate,
    MaterialMasterUpsert,
    SupplierResponse,
    SupplierAddressResponse,
    SupplierContactResponse,
    SupplierBankInfoResponse,
    SupplierDocumentResponse,
    CreateRfqRequest,
    RfqResponse,
    RfqItemSchema,
    SubmitQuotationRequest,
    QuotationResponse,
    QuotationLineSchema,
    QuotationDocumentSchema,
    CreateAsnRequest,
    AsnResponse,
    AsnLineSchema,
    AsnDocumentSchema,
    ArrivalNotificationResponse,
    PurchaseOrderResponse,
    PurchaseOrderItemSchema,
    MaterialRequestResponse,
    MaterialRequestItemSchema,
    CreateMaterialRequest,
    SupplierSelectionRequest,
    MaterialStockResponse,
    FinanceApprovalResponse,
    POApprovalHistorySchema,
    ProcurementStatsResponse,
    ProcurementTrendItem,
    SupplierLoginRequest,
    SupplierLoginResponse,
    ChangePasswordRequest,
    DevLoginRequest,
    GlobalSearchResponse,
)
from app.modules.procurement.infrastructure.persistence.models import (
    SupplierModel,
    SupplierAddressModel,
    VendorTypeModel,
    SupplierCategoryModel,
    RawMaterialMasterModel,
    SupplierUserModel,
    AsnModel,
    AsnLineModel,
    AsnDocumentModel,
    ArrivalNotificationModel,
    RfqModel,
    RfqItemModel,
    QuotationModel,
    QuotationLineModel,
    QuotationDocumentModel,
    PurchaseOrderModel,
    PurchaseOrderItemModel,
    MaterialRequestModel,
    MaterialRequestItemModel,
    MaterialModel,
    MaterialSubCategoryModel,
    MaterialIdentityModel,
    MaterialStockModel,
    StockReservationModel,
    PickTaskModel,
    MaterialIssueModel,
    POApprovalHistoryModel,
    NotificationModel,
)
from app.modules.procurement.infrastructure.persistence.repository_impl import (
    SqlAlchemySupplierRepository,
    SqlAlchemyRfqRepository,
    SqlAlchemyQuotationRepository,
    SqlAlchemyAsnRepository,
    SqlAlchemyArrivalNotificationRepository,
    SqlAlchemyPurchaseOrderRepository,
)
from app.common.email_utils import render_premium_email, send_email
from app.security.dependencies import CurrentUser, get_current_user
from app.modules.storage.infrastructure.persistence.models import InventoryLocationBalanceModel, StorageLocationModel

logger = get_logger(__name__)

router = APIRouter(prefix="/api/v1/procurement", tags=["procurement"])


def _normalize_material_name(name: str | None) -> str:
    """Normalize a material name for a stable, case-insensitive identity."""
    return " ".join((name or "").split()).casefold()


def _display_material_name(name: str | None) -> str:
    return " ".join((name or "").split())


async def _material_codes_by_name(session) -> dict[str, str]:
    """Return canonical codes, including legacy request and stock records."""
    identities = await session.execute(
        select(MaterialIdentityModel.normalized_name, MaterialIdentityModel.material_code)
    )
    codes = {name: code for name, code in identities.all()}

    # Existing data predates material_identity. It remains readable and is
    # adopted into the registry when the material is next requested.
    request_items = await session.execute(
        select(MaterialRequestItemModel.material_code, MaterialRequestItemModel.material_name)
    )
    stock_items = await session.execute(
        select(MaterialStockModel.material_code, MaterialStockModel.material_name)
        .order_by(MaterialStockModel.updated_at, MaterialStockModel.id)
    )
    for code, name in list(request_items.all()) + list(stock_items.all()):
        normalized_name = _normalize_material_name(name)
        if code and normalized_name:
            codes.setdefault(normalized_name, code)
    return codes


async def _next_material_sequence(session) -> int:
    master_codes = await session.execute(
        select(MaterialModel.code).where(MaterialModel.code.like("MAT-%"))
    )
    codes = await session.execute(
        select(MaterialRequestItemModel.material_code).where(MaterialRequestItemModel.material_code.like("MAT-%"))
    )
    stock_codes = await session.execute(
        select(MaterialStockModel.material_code).where(MaterialStockModel.material_code.like("MAT-%"))
    )
    registry_codes = await session.execute(
        select(MaterialIdentityModel.material_code).where(MaterialIdentityModel.material_code.like("MAT-%"))
    )

    def sequence(code: str) -> int:
        try:
            return int(code.rsplit("-", 1)[-1])
        except (AttributeError, ValueError):
            return 0

    existing_codes = (
        list(master_codes.scalars().all())
        + list(codes.scalars().all())
        + list(stock_codes.scalars().all())
        + list(registry_codes.scalars().all())
    )
    return max((sequence(code) for code in existing_codes), default=0) + 1


def canonical_warehouse_id(warehouse_id: str) -> str:
    """Translate legacy display names to the inventory warehouse identifier."""
    normalized = warehouse_id.strip()
    if normalized.casefold() in {"main", "main warehouse", "wh_pune-01"}:
        return "WH_PUNE-01"
    return normalized


@router.get("/health", tags=["ops"])
async def procurement_health() -> dict:
    return {"status": "UP", "module": "procurement", "version": "v13:master-data-post-added"}


@router.get("/stats", response_model=ProcurementStatsResponse)
async def get_procurement_stats(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    try:
        # 1. Active Suppliers
        active_stmt = select(func.count(SupplierModel.id)).where(SupplierModel.status == "Active")
        active_res = await uow.session.execute(active_stmt)
        active_suppliers = active_res.scalar() or 0

        # 1b. Active Suppliers added this month
        first_day_of_month = date(datetime.now().year, datetime.now().month, 1)
        active_this_month_stmt = select(func.count(SupplierModel.id)).where(
            SupplierModel.status == "Active",
            SupplierModel.created_at >= first_day_of_month
        )
        active_this_month_res = await uow.session.execute(active_this_month_stmt)
        active_suppliers_this_month = active_this_month_res.scalar() or 0

        # 1c. Total Suppliers (Supplier Master)
        total_suppliers_stmt = select(func.count(SupplierModel.id))
        total_suppliers_res = await uow.session.execute(total_suppliers_stmt)
        total_suppliers = total_suppliers_res.scalar() or 0

        # 2. Open POs (Approved but not yet Received)
        open_pos_stmt = select(func.count(PurchaseOrderModel.id)).where(
            PurchaseOrderModel.status.in_(["APPROVED", "SENT", "DISPATCHED", "SHIPPED"])
        )
        open_pos_res = await uow.session.execute(open_pos_stmt)
        open_pos = open_pos_res.scalar() or 0

        # 3. Total PO Value
        total_value_stmt = select(func.sum(PurchaseOrderModel.total_amount))
        total_value_res = await uow.session.execute(total_value_stmt)
        total_po_value = total_value_res.scalar() or Decimal("0.0")

        # 4. Compliance Rate
        # Metric: % of Approved POs that have an associated ASN
        total_approved_stmt = select(func.count(PurchaseOrderModel.id)).where(
            PurchaseOrderModel.status.in_(["APPROVED", "SENT", "DISPATCHED", "SHIPPED", "RECEIVED"])
        )
        total_approved_res = await uow.session.execute(total_approved_stmt)
        total_approved = total_approved_res.scalar() or 0

        if total_approved > 0:
            # Join PO with ASN to find how many have submissions
            # We use distinct po_id in AsnModel
            asns_with_po_stmt = select(func.count(func.distinct(AsnModel.po_id))).where(AsnModel.po_id.isnot(None))
            asns_with_po_res = await uow.session.execute(asns_with_po_stmt)
            compliant_pos = asns_with_po_res.scalar() or 0

            compliance_rate = (compliant_pos / total_approved) * 100
        else:
            compliance_rate = 100.0  # Default to 100% if no POs exist

        # 5. PO Issuance Trend (Last 6 Months)
        from datetime import timedelta
        trend = []
        # Get counts grouped by month
        # Since we might have months with 0 POs, we'll generate the last 6 months in Python
        current_date = datetime.now()
        for i in range(5, -1, -1):
            # Calculate first day of the month i months ago
            year = current_date.year
            month = current_date.month - i
            while month <= 0:
                month += 12
                year -= 1

            month_name = date(year, month, 1).strftime("%b")

            # Count POs in this specific month
            start_of_month = date(year, month, 1)
            if month == 12:
                end_of_month = date(year + 1, 1, 1)
            else:
                end_of_month = date(year, month + 1, 1)

            stmt = select(func.count(PurchaseOrderModel.id)).where(
                PurchaseOrderModel.po_date >= start_of_month,
                PurchaseOrderModel.po_date < end_of_month
            )
            res = await uow.session.execute(stmt)
            count = res.scalar() or 0
            trend.append(ProcurementTrendItem(month=month_name, pos=count))

        return ProcurementStatsResponse(
            active_suppliers=active_suppliers,
            active_suppliers_this_month=active_suppliers_this_month,
            total_suppliers=total_suppliers,
            open_pos=open_pos,
            compliance_rate=round(compliance_rate, 1),
            total_po_value=total_po_value,
            trend=trend
        )
    except Exception as e:
        logger.error(f"Failed to fetch stats: {e}", exc_info=True)
        # Fallback values if everything else fails
        return ProcurementStatsResponse(
            active_suppliers=0,
            active_suppliers_this_month=0,
            total_suppliers=0,
            open_pos=0,
            compliance_rate=100.0,
            total_po_value=Decimal("0.0"),
            trend=[]
        )


@router.get("/vendor-types")
async def list_vendor_types(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    result = await uow.session.execute(select(VendorTypeModel).order_by(VendorTypeModel.name))
    return result.scalars().all()


@router.post("/vendor-types", status_code=status.HTTP_201_CREATED)
async def create_vendor_type(
    request: MasterDataCreate,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    new_type = VendorTypeModel(name=request.name)
    uow.session.add(new_type)
    await uow.commit()
    return new_type


@router.get("/supplier-categories")
async def list_supplier_categories(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    result = await uow.session.execute(select(SupplierCategoryModel).order_by(SupplierCategoryModel.name))
    return result.scalars().all()


@router.post("/supplier-categories", status_code=status.HTTP_201_CREATED)
async def create_supplier_category(
    request: MasterDataCreate,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    new_cat = SupplierCategoryModel(name=request.name)
    uow.session.add(new_cat)
    await uow.commit()
    return new_cat


@router.get("/raw-materials")
async def list_raw_materials(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    result = await uow.session.execute(select(RawMaterialMasterModel).order_by(RawMaterialMasterModel.name))
    return result.scalars().all()


@router.post("/raw-materials", status_code=status.HTTP_201_CREATED)
async def create_raw_material(
    request: MasterDataCreate,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    new_mat = RawMaterialMasterModel(name=request.name)
    uow.session.add(new_mat)
    await uow.commit()
    return new_mat


@router.get("/material-catalog")
async def get_material_catalog(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
):
    """Return the canonical material master used by request lookup fields."""
    raw_result = await uow.session.execute(select(RawMaterialMasterModel).order_by(RawMaterialMasterModel.name))
    material_result = await uow.session.execute(select(MaterialModel).order_by(MaterialModel.name))
    identity_result = await uow.session.execute(
        select(MaterialIdentityModel).order_by(MaterialIdentityModel.display_name)
    )
    stock_result = await uow.session.execute(select(MaterialStockModel))

    raw_names = {material.name for material in raw_result.scalars().all()}
    materials = material_result.scalars().all()
    identities = identity_result.scalars().all()
    stocks = stock_result.scalars().all()
    code_by_name = await _material_codes_by_name(uow.session)
    catalog: dict[str, dict] = {}

    def add(name, code=None, category=None, description=None, uom=None, sub_category=None, barcode=None, minimum_price=None, maximum_price=None, currency=None, reorder_level=None):
        if not name:
            return
        key = _normalize_material_name(name)
        current = catalog.setdefault(key, {"name": _display_material_name(name), "variants": []})
        current["materialCode"] = code or current.get("materialCode") or code_by_name.get(key)
        current["category"] = category or current.get("category")
        current["description"] = description or current.get("description")
        current["uom"] = uom or current.get("uom")
        current["subCategory"] = sub_category or current.get("subCategory")
        current["barcode"] = barcode or current.get("barcode")
        current["minimumPrice"] = minimum_price if minimum_price is not None else current.get("minimumPrice")
        current["maximumPrice"] = maximum_price if maximum_price is not None else current.get("maximumPrice")
        current["currency"] = currency or current.get("currency") or "INR"
        current["reorderLevel"] = reorder_level if reorder_level is not None else current.get("reorderLevel")

    for material in materials:
        add(material.name, material.code, material.category, material.description, material.uom, material.sub_category, material.barcode, material.minimum_price, material.maximum_price, material.currency, material.reorder_level)
    for identity in identities:
        add(identity.display_name, identity.material_code)
    for stock in stocks:
        add(stock.material_name, stock.material_code, stock.category, uom=stock.uom)
    for name in raw_names:
        add(name)

    return sorted(catalog.values(), key=lambda item: item["name"].casefold())


def _material_master_response(material: MaterialModel) -> dict:
    return {
        "id": str(material.id), "code": material.code, "name": material.name,
        "description": material.description or "", "category": material.category,
        "subCategory": material.sub_category or "", "type": material.material_type,
        "uom": material.uom, "status": material.status,
        "minimumPrice": material.minimum_price, "standardPrice": material.standard_price,
        "maximumPrice": material.maximum_price, "currency": material.currency,
        "priceEffectiveFrom": material.price_effective_from, "priceEffectiveTo": material.price_effective_to,
        "priceThresholdStatus": material.price_threshold_status,
        "approvalRequiredAboveThreshold": material.approval_required_above_threshold,
        "lastPurchasePrice": material.last_purchase_price,
        "hsnCode": material.hsn_code, "gstRate": material.gst_rate,
        "minimumStock": material.minimum_stock, "maximumStock": material.maximum_stock,
        "reorderLevel": material.reorder_level, "safetyStock": material.safety_stock,
        "leadTimeDays": material.lead_time_days, "batchControlled": material.batch_controlled,
        "serialControlled": material.serial_controlled, "hazardous": material.hazardous,
        "barcode": material.barcode,
    }


@router.get("/materials")
async def list_material_master(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(MaterialModel).order_by(MaterialModel.code))
    return [_material_master_response(material) for material in result.scalars().all()]


@router.get("/material-sub-categories")
async def list_material_sub_categories(uow: UnitOfWork = Depends(get_uow)):
    saved_result = await uow.session.execute(
        select(MaterialSubCategoryModel.name).order_by(MaterialSubCategoryModel.name)
    )
    material_result = await uow.session.execute(
        select(MaterialModel.sub_category).where(MaterialModel.sub_category.is_not(None))
    )
    names = {name.strip() for name in [*saved_result.scalars().all(), *material_result.scalars().all()] if name and name.strip()}
    return sorted(names, key=str.casefold)


@router.post("/material-sub-categories", status_code=status.HTTP_201_CREATED)
async def create_material_sub_category(request: MasterDataCreate, uow: UnitOfWork = Depends(get_uow)):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Sub category name is required")
    existing = await uow.session.scalar(
        select(MaterialSubCategoryModel).where(func.lower(MaterialSubCategoryModel.name) == name.lower())
    )
    if existing:
        return {"id": existing.id, "name": existing.name}
    sub_category = MaterialSubCategoryModel(name=name)
    uow.session.add(sub_category)
    await uow.commit()
    await uow.session.refresh(sub_category)
    return {"id": sub_category.id, "name": sub_category.name}


@router.post("/materials", status_code=status.HTTP_201_CREATED)
async def create_material_master(request: MaterialMasterUpsert, uow: UnitOfWork = Depends(get_uow)):
    code = request.code.strip().upper()
    name = _display_material_name(request.name)
    duplicate = await uow.session.scalar(
        select(MaterialModel.id).where(or_(func.lower(MaterialModel.code) == code.lower(),
                                           func.lower(MaterialModel.name) == name.lower()))
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Material code or name already exists")
    material = MaterialModel(
        id=uuid.uuid4(), code=code, name=name, description=request.description,
        category=request.category.strip(), sub_category=request.sub_category,
        material_type=request.material_type, uom=request.uom, status=request.status,
        minimum_price=request.minimum_price, standard_price=request.standard_price,
        maximum_price=request.maximum_price, currency=request.currency.upper(),
        price_effective_from=request.price_effective_from, price_effective_to=request.price_effective_to,
        price_threshold_status=request.price_threshold_status,
        approval_required_above_threshold=request.approval_required_above_threshold,
        last_purchase_price=request.last_purchase_price,
        hsn_code=request.hsn_code, gst_rate=request.gst_rate,
        minimum_stock=request.minimum_stock, maximum_stock=request.maximum_stock,
        reorder_level=request.reorder_level, safety_stock=request.safety_stock,
        lead_time_days=request.lead_time_days, batch_controlled=request.batch_controlled,
        serial_controlled=request.serial_controlled, hazardous=request.hazardous,
        barcode=request.barcode.strip() if request.barcode else None,
    )
    uow.session.add(material)
    identity = await uow.session.scalar(
        select(MaterialIdentityModel).where(
            or_(MaterialIdentityModel.material_code == code,
                MaterialIdentityModel.normalized_name == _normalize_material_name(name))
        )
    )
    if identity and (identity.material_code != code or identity.normalized_name != _normalize_material_name(name)):
        raise HTTPException(status_code=409, detail="Material code or name is already registered")
    if not identity:
        uow.session.add(MaterialIdentityModel(
            id=uuid.uuid4(), normalized_name=_normalize_material_name(name),
            material_code=code, display_name=name,
        ))
    await uow.commit()
    return _material_master_response(material)


@router.put("/materials/{material_id}")
async def update_material_master(material_id: str, request: MaterialMasterUpsert, uow: UnitOfWork = Depends(get_uow)):
    material = await uow.session.get(MaterialModel, uuid.UUID(material_id))
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    material.name = _display_material_name(request.name)
    material.description = request.description
    material.category = request.category.strip()
    material.sub_category = request.sub_category
    material.material_type = request.material_type
    material.uom = request.uom
    material.status = request.status
    material.minimum_price = request.minimum_price
    material.standard_price = request.standard_price
    material.maximum_price = request.maximum_price
    material.currency = request.currency.upper()
    material.price_effective_from = request.price_effective_from
    material.price_effective_to = request.price_effective_to
    material.price_threshold_status = request.price_threshold_status
    material.approval_required_above_threshold = request.approval_required_above_threshold
    material.last_purchase_price = request.last_purchase_price
    material.hsn_code = request.hsn_code
    material.gst_rate = request.gst_rate
    material.minimum_stock = request.minimum_stock
    material.maximum_stock = request.maximum_stock
    material.reorder_level = request.reorder_level
    material.safety_stock = request.safety_stock
    material.lead_time_days = request.lead_time_days
    material.batch_controlled = request.batch_controlled
    material.serial_controlled = request.serial_controlled
    material.hazardous = request.hazardous
    material.barcode = request.barcode.strip() if request.barcode else None
    identity = await uow.session.scalar(
        select(MaterialIdentityModel).where(MaterialIdentityModel.material_code == material.code)
    )
    if identity:
        identity.normalized_name = _normalize_material_name(material.name)
        identity.display_name = material.name
    await uow.commit()
    return _material_master_response(material)


@router.delete("/materials/{material_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_material_master(material_id: str, uow: UnitOfWork = Depends(get_uow)):
    material = await uow.session.get(MaterialModel, uuid.UUID(material_id))
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    used = await uow.session.scalar(
        select(MaterialRequestItemModel.id).where(MaterialRequestItemModel.material_code == material.code).limit(1)
    )
    if used:
        raise HTTPException(status_code=409, detail="Used materials cannot be deleted; deactivate it instead")
    identity = await uow.session.scalar(
        select(MaterialIdentityModel).where(MaterialIdentityModel.material_code == material.code)
    )
    if identity:
        await uow.session.delete(identity)
    await uow.session.delete(material)
    await uow.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# --- Material Requests ---

@router.get("/material-requests/next-number")
async def get_next_mr_number(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    """Return the next persisted material-request number and next material sequence."""
    from app.modules.procurement.infrastructure.persistence.repository_impl import SqlAlchemyMaterialRequestRepository

    repo = SqlAlchemyMaterialRequestRepository(uow.session)
    use_case = GetNextMaterialRequestNumberUseCase(repo)
    num = await use_case.handle()

    next_seq = await _next_material_sequence(uow.session)

    return {
        "requestNumber": num,
        "nextMaterialSequence": next_seq
    }


@router.get("/material-requests", response_model=List[MaterialRequestResponse])
async def list_material_requests(uow: UnitOfWork = Depends(get_uow)):
    stmt = select(MaterialRequestModel).options(selectinload(MaterialRequestModel.items)).order_by(MaterialRequestModel.created_at.desc())
    res = await uow.session.execute(stmt)
    entities = res.scalars().all()
    pick_result = await uow.session.execute(select(PickTaskModel))
    picks = {pick.request_id: pick for pick in pick_result.scalars().all()}
    return [
        MaterialRequestResponse(
            id=str(m.id),
            request_number=m.request_number,
            warehouse_id=m.warehouse_id,
            department=m.department,
            requested_by=m.requested_by,
            status=m.status,
            required_date=m.required_date,
            remarks=m.remarks,
            items=[
                MaterialRequestItemSchema(
                    material_code=it.material_code,
                    material_name=it.material_name,
                    quantity=it.quantity,
                    uom=it.uom
                )
                for it in m.items
            ],
            created_at=m.created_at,
            approved_by=m.approved_by,
            approved_at=m.approved_at,
            pick_task=({"id": str(picks[m.id].id), "task_number": picks[m.id].task_number,
                        "status": picks[m.id].status, "items": picks[m.id].items,
                        "created_at": picks[m.id].created_at.isoformat()} if m.id in picks else None),
        )
        for m in entities
    ]


@router.post("/material-requests", status_code=status.HTTP_201_CREATED)
async def create_material_request(request: CreateMaterialRequest, uow: UnitOfWork = Depends(get_uow)):
    if request.request_number:
        req_no = request.request_number
    else:
        from app.modules.procurement.infrastructure.persistence.repository_impl import SqlAlchemyMaterialRequestRepository
        repo = SqlAlchemyMaterialRequestRepository(uow.session)
        use_case = GetNextMaterialRequestNumberUseCase(repo)
        req_no = await use_case.handle()

    # Material codes are allocated once per material name and kept in the
    # registry for every downstream workflow.
    next_material_sequence = await _next_material_sequence(uow.session)

    new_mr = MaterialRequestModel(
        id=uuid.uuid4(),
        request_number=req_no,
        warehouse_id=canonical_warehouse_id(request.warehouse_id),
        department=request.department,
        requested_by=request.requested_by,
        status="SUBMITTED",
        required_date=request.required_date,
        remarks=request.remarks
    )

    for it in request.items:
        requested_code = (it.material_code or "").strip().upper()
        material = await uow.session.scalar(
            select(MaterialModel).where(func.lower(MaterialModel.code) == requested_code.lower())
        )
        if not material:
            raise HTTPException(status_code=422, detail=f"Material '{requested_code or it.material_name}' must be selected from Material Master")
        if material.status.lower() != "active":
            raise HTTPException(status_code=422, detail=f"Material '{material.code}' is inactive")

        new_mr.items.append(MaterialRequestItemModel(
            id=uuid.uuid4(),
            material_code=material.code,
            material_name=material.name,
            quantity=it.quantity,
            uom=material.uom
        ))

    uow.session.add(new_mr)
    await uow.commit()
    return {
        "status": "success",
        "request_number": req_no,
        "items": [
            {"material_code": item.material_code, "material_name": item.material_name}
            for item in new_mr.items
        ],
    }


@router.post("/material-requests/{id}/process")
async def process_material_request(id: str, uow: UnitOfWork = Depends(get_uow)):
    stmt = (select(MaterialRequestModel).options(selectinload(MaterialRequestModel.items))
            .where(MaterialRequestModel.id == uuid.UUID(id)).with_for_update())
    res = await uow.session.execute(stmt)
    req = res.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail="Material request not found")
    if req.status != "PENDING":
        raise HTTPException(status_code=409, detail="Only pending material requests can be approved")

    warehouse_id = canonical_warehouse_id(req.warehouse_id)

    stocks = {}
    shortages = []
    for item in req.items:
        stock_result = await uow.session.execute(
            select(MaterialStockModel).where(
                MaterialStockModel.material_code == item.material_code,
                MaterialStockModel.warehouse_id == warehouse_id,
            ).with_for_update()
        )
        stock = stock_result.scalar_one_or_none()
        stocks[item.id] = stock
        if stock is None or stock.available < item.quantity:
            shortages.append({"material_code": item.material_code, "material_name": item.material_name,
                              "requested": float(item.quantity), "available": float(stock.available) if stock else 0,
                              "uom": item.uom})
    if shortages:
        raise HTTPException(status_code=409, detail={"message": "Insufficient available stock", "shortages": shortages})

    approved_at = datetime.now()
    approver = "Warehouse Manager"
    pick_items = []
    inventory_updates = []
    for item in req.items:
        stock = stocks[item.id]
        balance_result = await uow.session.execute(
            select(InventoryLocationBalanceModel, StorageLocationModel)
            .join(StorageLocationModel, StorageLocationModel.id == InventoryLocationBalanceModel.storage_location_id)
            .where(InventoryLocationBalanceModel.material_code == item.material_code,
                   InventoryLocationBalanceModel.warehouse_id == warehouse_id,
                   InventoryLocationBalanceModel.available_quantity > 0)
            .order_by(InventoryLocationBalanceModel.updated_at, StorageLocationModel.location_code)
            .with_for_update()
        )
        remaining = item.quantity
        allocations = []
        for balance, location in balance_result.all():
            if remaining <= 0:
                break
            picked = min(balance.available_quantity, remaining)
            balance.available_quantity -= picked
            remaining -= picked
            allocations.append({"balance_id": str(balance.id), "location_id": str(location.id), "location": location.location_code,
                                "quantity": float(picked), "uom": item.uom})
        if remaining > 0:
            raise HTTPException(status_code=409, detail={"message": "Stored location stock is insufficient",
                                                        "material_code": item.material_code,
                                                        "shortage": float(remaining)})
        stock.available -= item.quantity
        stock.allocated += item.quantity
        stock.updated_at = approved_at
        inventory_updates.append({"material_code": stock.material_code, "material_name": stock.material_name,
                                  "on_hand": float(stock.on_hand), "allocated": float(stock.allocated),
                                  "available": float(stock.available), "reserved": float(item.quantity),
                                  "uom": stock.uom, "warehouse_id": stock.warehouse_id,
                                  "allocations": allocations})
        uow.session.add(StockReservationModel(
            id=uuid.uuid4(), request_id=req.id, request_item_id=item.id,
            material_code=item.material_code, warehouse_id=warehouse_id,
            quantity=item.quantity, uom=item.uom, status="RESERVED",
            allocations=allocations,
            reserved_by=approver, reserved_at=approved_at,
        ))
        pick_items.append({"material_code": item.material_code, "material_name": item.material_name,
                           "quantity": float(item.quantity), "uom": item.uom, "allocations": allocations})
    pick_count = await uow.session.scalar(select(func.count(PickTaskModel.id))) or 0
    pick = PickTaskModel(
        id=uuid.uuid4(), task_number=f"PT-{approved_at.year}-{pick_count + 1:04d}",
        request_id=req.id, request_number=req.request_number, warehouse_id=warehouse_id,
        department=req.department, items=pick_items, status="OPEN", destination="Production Staging Area",
        created_by=approver, created_at=approved_at,
    )
    uow.session.add(pick)
    req.status = "RESERVED"
    req.approved_by = approver
    req.approved_at = approved_at
    await uow.commit()
    return {"status": req.status, "request_number": req.request_number,
            "approval": {"approved_by": approver, "approved_at": approved_at.isoformat()},
            "availability_check": "PASSED", "reservation_status": "RESERVED",
            "inventory_updates": inventory_updates,
            "pick_task": {"id": str(pick.id), "task_number": pick.task_number,
                          "status": pick.status, "items": pick.items}}


@router.get("/pick-tasks")
async def list_pick_tasks(uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(PickTaskModel).order_by(PickTaskModel.created_at.desc()))
    return [{"id": str(task.id), "task_number": task.task_number, "request_id": str(task.request_id),
             "request_number": task.request_number, "warehouse_id": task.warehouse_id,
             "department": task.department, "destination": task.destination, "items": task.items, "status": task.status,
             "assigned_to": task.assigned_to, "assigned_at": task.assigned_at.isoformat() if task.assigned_at else None,
             "started_at": task.started_at.isoformat() if task.started_at else None,
             "completed_at": task.completed_at.isoformat() if task.completed_at else None,
             "completed_by": task.completed_by,
             "created_by": task.created_by, "created_at": task.created_at.isoformat()}
            for task in result.scalars().all()]


@router.post("/pick-tasks/{task_id}/assign")
async def assign_pick_task(task_id: uuid.UUID, operator: str = Query(..., min_length=1), uow: UnitOfWork = Depends(get_uow)):
    task = await uow.session.get(PickTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Pick task not found")
    if task.status != "OPEN":
        raise HTTPException(status_code=409, detail="Only open pick tasks can be assigned")
    task.assigned_to = operator.strip()
    task.assigned_at = datetime.now()
    task.status = "ASSIGNED"
    await uow.commit()
    return {"id": str(task.id), "status": task.status, "assigned_to": task.assigned_to, "assigned_at": task.assigned_at.isoformat()}


@router.post("/pick-tasks/{task_id}/start")
async def start_pick_task(task_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    task = await uow.session.get(PickTaskModel, task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Pick task not found")
    if task.status != "ASSIGNED":
        raise HTTPException(status_code=409, detail="Pick task must be assigned before picking starts")
    task.status = "IN_PROGRESS"
    task.started_at = datetime.now()
    await uow.commit()
    return {"id": str(task.id), "status": task.status, "started_at": task.started_at.isoformat()}


@router.post("/pick-tasks/{task_id}/complete")
async def complete_pick_task(task_id: uuid.UUID, uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(PickTaskModel).where(PickTaskModel.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Pick task not found")
    if task.status != "IN_PROGRESS":
        raise HTTPException(status_code=409, detail="Pick task must be in progress")
    reservations_result = await uow.session.execute(select(StockReservationModel).where(
        StockReservationModel.request_id == task.request_id).with_for_update())
    stock_updates = []
    for reservation in reservations_result.scalars().all():
        if reservation.status != "RESERVED":
            raise HTTPException(status_code=409, detail="Pick task reservation is no longer active")
        stock_result = await uow.session.execute(select(MaterialStockModel).where(
            MaterialStockModel.material_code == reservation.material_code,
            MaterialStockModel.warehouse_id == reservation.warehouse_id).with_for_update())
        stock = stock_result.scalar_one()
        before = {"on_hand": float(stock.on_hand), "allocated": float(stock.allocated), "available": float(stock.available)}
        stock.allocated -= reservation.quantity
        stock.available += reservation.quantity
        stock.updated_at = datetime.now()
        for allocation in reservation.allocations:
            location_id = uuid.UUID(allocation["location_id"])
            if allocation.get("balance_id"):
                balance = await uow.session.get(InventoryLocationBalanceModel, uuid.UUID(allocation["balance_id"]), with_for_update=True)
            else:
                balance_result = await uow.session.execute(select(InventoryLocationBalanceModel).where(
                    InventoryLocationBalanceModel.material_code == reservation.material_code,
                    InventoryLocationBalanceModel.storage_location_id == location_id).with_for_update())
                balance = balance_result.scalar_one()
            balance.available_quantity += Decimal(str(allocation["quantity"]))
        reservation.status = "PICKED"
        stock_updates.append({"material_code": stock.material_code, "material_name": stock.material_name,
                              "uom": stock.uom, "before": before,
                              "after": {"on_hand": float(stock.on_hand), "allocated": float(stock.allocated),
                                        "available": float(stock.available)}})
    task.status = "COMPLETED"
    task.completed_at = datetime.now()
    task.completed_by = task.assigned_to
    request_record = await uow.session.get(MaterialRequestModel, task.request_id, with_for_update=True)
    request_record.status = "PICKED"
    await uow.commit()
    return {"id": str(task.id), "task_number": task.task_number, "status": task.status,
            "destination": task.destination, "completed_by": task.completed_by,
            "completed_at": task.completed_at.isoformat(), "stock_updates": stock_updates,
            "ownership_status": "WAREHOUSE_OWNED", "next_step": "ISSUE_OR_CONSUMPTION"}


@router.post("/pick-tasks/{task_id}/issue")
async def issue_picked_material(task_id: uuid.UUID, received_by: str = Query(..., min_length=1), uow: UnitOfWork = Depends(get_uow)):
    result = await uow.session.execute(select(PickTaskModel).where(PickTaskModel.id == task_id).with_for_update())
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Pick task not found")
    if task.status != "COMPLETED":
        raise HTTPException(status_code=409, detail="Picking must be completed before material issue")
    existing = await uow.session.scalar(select(MaterialIssueModel.id).where(MaterialIssueModel.pick_task_id == task.id))
    if existing:
        raise HTTPException(status_code=409, detail="Material was already issued")
    reservations_result = await uow.session.execute(select(StockReservationModel).where(
        StockReservationModel.request_id == task.request_id).with_for_update())
    stock_updates = []
    for reservation in reservations_result.scalars().all():
        if reservation.status != "PICKED":
            raise HTTPException(status_code=409, detail="Picked reservation is not ready for issue")
        stock_result = await uow.session.execute(select(MaterialStockModel).where(
            MaterialStockModel.material_code == reservation.material_code,
            MaterialStockModel.warehouse_id == reservation.warehouse_id).with_for_update())
        stock = stock_result.scalar_one()
        before = float(stock.on_hand)
        stock.on_hand -= reservation.quantity
        stock.available -= reservation.quantity
        for allocation in reservation.allocations:
            location_id = uuid.UUID(allocation["location_id"])
            balance_result = await uow.session.execute(select(InventoryLocationBalanceModel).where(
                InventoryLocationBalanceModel.material_code == reservation.material_code,
                InventoryLocationBalanceModel.storage_location_id == location_id).with_for_update())
            balance = balance_result.scalar_one()
            location = await uow.session.get(StorageLocationModel, location_id, with_for_update=True)
            quantity = Decimal(str(allocation["quantity"]))
            balance.quantity -= quantity
            balance.available_quantity -= quantity
            location.occupied_quantity -= quantity
        reservation.status = "ISSUED"
        stock_updates.append({"material_code": stock.material_code, "material_name": stock.material_name,
                              "issued": float(reservation.quantity), "uom": stock.uom,
                              "on_hand_before": before, "on_hand_after": float(stock.on_hand),
                              "available_after": float(stock.available)})
    issued_at = datetime.now()
    issue_count = await uow.session.scalar(select(func.count(MaterialIssueModel.id))) or 0
    issue = MaterialIssueModel(id=uuid.uuid4(), issue_number=f"MI-{issued_at.year}-{issue_count + 1:04d}",
                               pick_task_id=task.id, request_id=task.request_id, department=task.department,
                               items=task.items, issued_by=task.completed_by or task.created_by,
                               received_by=received_by.strip(), issued_at=issued_at)
    uow.session.add(issue)
    # MaterialIssueModel and AssemblyOrderModel do not have an ORM relationship,
    # so SQLAlchemy cannot infer that the issue must be inserted first.  Flush it
    # before creating the assembly order that references it.
    await uow.session.flush([issue])
    request_record = await uow.session.get(MaterialRequestModel, task.request_id, with_for_update=True)
    request_record.status = "ISSUED"
    task.status = "ISSUED"
    from app.modules.assembly.infrastructure.api.router import create_order_for_issue
    assembly_order = await create_order_for_issue(uow, task, issue)
    await uow.commit()
    return {"id": str(issue.id), "issue_number": issue.issue_number, "status": "ISSUED",
            "received_by": issue.received_by, "issued_at": issue.issued_at.isoformat(),
            "stock_updates": stock_updates, "ownership_status": "ISSUED_TO_PRODUCTION",
            "assembly_order": {"id": str(assembly_order.id), "order_number": assembly_order.order_number,
                               "status": assembly_order.status}}


@router.put("/material-requests/{id}")
async def update_material_request(id: str, request: CreateMaterialRequest, uow: UnitOfWork = Depends(get_uow)):
    stmt = select(MaterialRequestModel).options(selectinload(MaterialRequestModel.items)).where(MaterialRequestModel.id == uuid.UUID(id))
    res = await uow.session.execute(stmt)
    mr = res.scalar_one_or_none()
    if not mr:
        raise HTTPException(status_code=404, detail="Material request not found")

    mr.department = request.department
    mr.required_date = request.required_date
    mr.remarks = request.remarks

    # Standard sync: clear and re-add (cascade="all, delete-orphan" handles deletion)
    from app.modules.procurement.infrastructure.persistence.models import MaterialRequestItemModel
    mr.items = []
    known_by_name = await _material_codes_by_name(uow.session)
    for it in request.items:
        normalized_name = _normalize_material_name(it.material_name)
        if not normalized_name:
            raise HTTPException(status_code=422, detail="Material name is required")
        canonical_code = known_by_name.get(normalized_name)
        if not canonical_code:
            raise HTTPException(
                status_code=422,
                detail=f"Unknown material '{_display_material_name(it.material_name)}'. Create it through a material request first.",
            )
        mr.items.append(MaterialRequestItemModel(
            id=uuid.uuid4(),
            material_code=canonical_code,
            material_name=_display_material_name(it.material_name),
            quantity=it.quantity,
            uom=it.uom
        ))

    await uow.commit()
    return {"status": "success"}


@router.get("/material-stock", response_model=List[MaterialStockResponse])
async def list_material_stock(uow: UnitOfWork = Depends(get_uow)):
    try:
        stmt = select(MaterialStockModel).order_by(MaterialStockModel.material_code)
        res = await uow.session.execute(stmt)
        entities = res.scalars().all()

        return [
            MaterialStockResponse(
                id=str(s.id),
                material_code=s.material_code,
                material_name=s.material_name,
                category=s.category,
                on_hand=s.on_hand,
                allocated=s.allocated,
                available=s.available,
                uom=s.uom,
                warehouse_id=s.warehouse_id,
                reorder_point=s.reorder_point,
                updated_at=s.updated_at
            )
            for s in entities
        ]
    except Exception as e:
        logger.error(f"Failed to list material stock: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _response_from_entity(entity: SupplierModel) -> SupplierResponse:
    """
    Safely maps a SupplierModel to a SupplierResponse, ensuring no lazy-load
    exceptions occur in an async context.
    """
    from sqlalchemy import inspect

    try:
        e_id = str(getattr(entity, 'id', uuid.uuid4()))
        e_name = getattr(entity, 'supplier_name', 'Unknown')

        # Check SQLAlchemy state to see what is already loaded
        state = None
        try:
            state = inspect(entity)
        except Exception:
            state = None

        # Helper to get relationship only if loaded
        def get_rel(name):
            try:
                if state and hasattr(state, "unloaded") and name in state.unloaded:
                    return None
                return getattr(entity, name, None)
            except (AttributeError, Exception):
                return None

        addr = get_rel('address')
        cont = get_rel('contact')
        bank = get_rel('bank_info')
        docs = get_rel('documents') or []

        return SupplierResponse(
            supplier_id=e_id,
            supplier_code=getattr(entity, 'supplier_code', None),
            supplier_name=e_name,
            registered_company_name=getattr(entity, 'registered_company_name', None),
            vendor_type=getattr(entity, 'vendor_type', None),
            category=getattr(entity, 'category', []) if isinstance(getattr(entity, 'category', None), list) else ([getattr(entity, 'category')] if getattr(entity, 'category', None) else []),
            industry=getattr(entity, 'industry', None),
            gstin=getattr(entity, 'gstin', None),
            main_materials=getattr(entity, 'main_materials', []) if isinstance(getattr(entity, 'main_materials', None), list) else [],
            address=SupplierAddressResponse(
                registered_address=getattr(addr, 'registered_address', None),
                city=getattr(addr, 'city', None),
                country=getattr(addr, 'country', None),
                state=getattr(addr, 'state', None),
                pincode=getattr(addr, 'pincode', None),
            ) if addr else None,
            contact=SupplierContactResponse(
                primary_contact_name=getattr(cont, 'primary_contact_name', None),
                primary_email=getattr(cont, 'primary_email', None),
                secondary_email=getattr(cont, 'secondary_email', None),
                designation=getattr(cont, 'designation', None),
                phone=getattr(cont, 'phone', None),
                website=getattr(cont, 'website', None),
            ) if cont else None,
            bank_info=SupplierBankInfoResponse(
                bank_name=getattr(bank, 'bank_name', None),
                account_number=getattr(bank, 'account_number', None),
                account_holder_name=getattr(bank, 'account_holder_name', None),
                ifsc=getattr(bank, 'ifsc', None),
                branch=getattr(bank, 'branch', None),
                swift_bic=getattr(bank, 'swift_bic', None),
                tds_section=getattr(bank, 'tds_section', None),
            ) if bank else None,
            documents=[
                SupplierDocumentResponse(
                    document_type=getattr(d, 'document_type', None),
                    file_name=getattr(d, 'file_name', None),
                    storage_path=getattr(d, 'storage_path', None),
                    upload_id=getattr(d, 'upload_id', None),
                    file_type=getattr(d, 'file_type', None),
                    file_size=getattr(d, 'file_size', None),
                )
                for d in docs
            ],
            remarks=getattr(entity, 'remarks', None),
            status=getattr(entity, 'status', "Active"),
            created_at=getattr(entity, 'created_at', None),
            created_by=getattr(entity, 'created_by', None),
            updated_at=getattr(entity, 'updated_at', None),
            updated_by=getattr(entity, 'updated_by', None),
        )
    except Exception as exc:
        logger.error(f"Mapping crash for supplier {getattr(entity, 'id', 'unknown')}: {exc}", exc_info=True)
        return SupplierResponse(
            supplier_id=str(getattr(entity, 'id', 'error')),
            supplier_code=getattr(entity, 'supplier_code', None),
            supplier_name=getattr(entity, 'supplier_name', "Mapping Error"),
            created_at=datetime.now()
        )


async def _backfill_missing_supplier_codes(uow: UnitOfWork) -> None:
    """Persist codes for suppliers created before supplier_code was introduced."""
    result = await uow.session.execute(select(SupplierModel.supplier_code))
    used = {
        int(code[4:])
        for code in result.scalars()
        if code and code.startswith("SUP-") and code[4:].isdigit()
    }
    missing_result = await uow.session.execute(
        select(SupplierModel)
        .where(SupplierModel.supplier_code.is_(None))
        .order_by(SupplierModel.created_at, SupplierModel.id)
    )
    missing = missing_result.scalars().all()
    if not missing:
        return

    sequence = 1
    for supplier in missing:
        while sequence in used:
            sequence += 1
        supplier.supplier_code = f"SUP-{sequence:05d}"
        used.add(sequence)
        sequence += 1
    await uow.commit()


@router.post("/suppliers/documents")
async def upload_supplier_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Standard upload endpoint for supplier onboarding documents.
    Saves to media_uploads/suppliers/ and returns metadata for the create_supplier call.
    """
    from pathlib import Path

    # Resolve from the service root instead of the process working directory.
    # Windows services and IDE launch configurations often start elsewhere.
    service_root = Path(__file__).resolve().parents[5]
    upload_dir = service_root / "media_uploads" / "suppliers"

    # Unique file name to prevent collisions
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = upload_dir / unique_filename

    try:
        upload_dir.mkdir(parents=True, exist_ok=True)
        contents = await file.read()
        if not contents:
            raise ValueError("Uploaded file is empty")
        dest_path.write_bytes(contents)
    except Exception as e:
        logger.exception("Failed to save uploaded supplier document to %s", dest_path)
        raise HTTPException(status_code=500, detail="Could not save file")

    # Return metadata as expected by CreateSupplierRequest
    return {
        "document_type": document_type,
        "file_name": file.filename,
        "storage_path": f"/media/suppliers/{unique_filename}",
        "upload_id": str(uuid.uuid4()),
        "file_type": file.content_type,
        "file_size": dest_path.stat().st_size
    }


@router.get("/suppliers/check-existence")
async def check_supplier_existence(
    company_name: Optional[str] = Query(None),
    gstin: Optional[str] = Query(None),
    email: Optional[str] = Query(None),
    phone: Optional[str] = Query(None),
    account_number: Optional[str] = Query(None),
    swift: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
):
    repo = SqlAlchemySupplierRepository(uow.session)
    results = {}
    if company_name:
        results["company_name"] = await repo.exists_by_company_name(company_name)
    if gstin:
        results["gstin"] = await repo.exists_by_gstin(gstin)
    if email:
        results["email"] = await repo.exists_by_email(email)
    if phone:
        results["phone"] = await repo.exists_by_phone(phone)
    if account_number:
        results["account_number"] = await repo.exists_by_bank_account(account_number)
    if swift:
        results["swift"] = await repo.exists_by_swift(swift)
    return results


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    request: CreateSupplierRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    repo = SqlAlchemySupplierRepository(uow.session)
    use_case = CreateSupplierUseCase(repo)

    address_cmd = AddressCommand(**request.address.dict()) if request.address else None
    contact_cmd = ContactCommand(**request.contact.dict()) if request.contact else None
    bank_info_cmd = BankInfoCommand(**request.bank_info.dict()) if request.bank_info else None
    doc_cmds = [DocumentCommand(**d.dict()) for d in request.documents]

    command = CreateSupplierCommand(
        supplier_name=request.supplier_name,
        registered_company_name=request.registered_company_name,
        vendor_type=request.vendor_type,
        category=request.category,
        industry=request.industry,
        gstin=request.gstin,
        main_materials=request.main_materials,
        address=address_cmd,
        contact=contact_cmd,
        bank_info=bank_info_cmd,
        documents=doc_cmds,
        remarks=request.remarks,
        created_by=_user.username,
    )
    supplier_id = await use_case.handle(command)
    entity = await repo.find_by_id(supplier_id)
    return _response_from_entity(entity)


@router.get("/suppliers", response_model=List[SupplierResponse])
async def list_suppliers(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[SupplierResponse]:
    try:
        await _backfill_missing_supplier_codes(uow)
        stmt = select(SupplierModel).options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact),
            selectinload(SupplierModel.bank_info),
            selectinload(SupplierModel.documents),
        )
        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    SupplierModel.supplier_name.ilike(search_term),
                    SupplierModel.supplier_code.ilike(search_term),
                    SupplierModel.registered_company_name.ilike(search_term)
                )
            )
        if category:
            from sqlalchemy import cast, String
            stmt = stmt.where(cast(SupplierModel.category, String).ilike(f"%{category}%"))
        if material:
            from sqlalchemy import cast, String
            stmt = stmt.where(cast(SupplierModel.main_materials, String).ilike(f"%{material}%"))
        if status_filter:
            stmt = stmt.where(func.lower(SupplierModel.status) == status_filter.strip().lower())

        result = await uow.session.execute(stmt.order_by(SupplierModel.supplier_name))
        entities = result.scalars().all()

        responses = []
        for e in entities:
            try:
                responses.append(_response_from_entity(e))
            except Exception as err:
                logger.error(f"Error mapping supplier {getattr(e, 'id', 'unknown')}: {err}")
        return responses
    except Exception as e:
        logger.error(f"Failed to list suppliers: {e}", exc_info=True)
        # Return specific error message to help debug
        raise HTTPException(status_code=500, detail=f"Database error in list_suppliers: {str(e)}")


@router.get("/suppliers/{id}", response_model=SupplierResponse)
async def get_supplier(
    id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    try:
        await _backfill_missing_supplier_codes(uow)
        stmt = select(SupplierModel).options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact),
            selectinload(SupplierModel.bank_info),
            selectinload(SupplierModel.documents),
        ).where(SupplierModel.id == id)

        result = await uow.session.execute(stmt)
        entity = result.scalar_one_or_none()

        if not entity:
            raise HTTPException(status_code=404, detail="Supplier not found")

        return _response_from_entity(entity)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get supplier {id}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database error in get_supplier: {str(e)}")


@router.put("/suppliers/{id}", response_model=SupplierResponse)
async def update_supplier(
    id: str,
    request: UpdateSupplierRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    try:
        repo = SqlAlchemySupplierRepository(uow.session)
        use_case = UpdateSupplierUseCase(repo)

        address_cmd = AddressCommand(**request.address.model_dump()) if request.address else None
        contact_cmd = ContactCommand(**request.contact.model_dump()) if request.contact else None
        bank_info_cmd = BankInfoCommand(**request.bank_info.model_dump()) if request.bank_info else None

        command = UpdateSupplierCommand(
            supplier_id=id,
            supplier_name=request.supplier_name,
            registered_company_name=request.registered_company_name,
            vendor_type=request.vendor_type,
            category=request.category,
            industry=request.industry,
            gstin=request.gstin,
            main_materials=request.main_materials,
            address=address_cmd,
            contact=contact_cmd,
            bank_info=bank_info_cmd,
            remarks=request.remarks,
            updated_by=_user.username,
        )
        await use_case.handle(command)
        await uow.commit()

        # Fetch model directly for response mapping (to avoid domain object mismatch)
        stmt = select(SupplierModel).options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact),
            selectinload(SupplierModel.bank_info),
            selectinload(SupplierModel.documents),
        ).where(SupplierModel.id == id)
        res = await uow.session.execute(stmt)
        entity = res.scalar_one_or_none()

        return _response_from_entity(entity)
    except Exception as e:
        logger.error(f"Update supplier {id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suppliers/{id}/block", response_model=SupplierResponse)
async def block_supplier(
    id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    try:
        repo = SqlAlchemySupplierRepository(uow.session)
        use_case = BlockSupplierUseCase(repo)
        await use_case.handle(id)
        await uow.commit()

        stmt = select(SupplierModel).options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact),
            selectinload(SupplierModel.bank_info),
            selectinload(SupplierModel.documents),
        ).where(SupplierModel.id == id)
        res = await uow.session.execute(stmt)
        entity = res.scalar_one_or_none()

        return _response_from_entity(entity)
    except Exception as e:
        logger.error(f"Block supplier {id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/suppliers/{id}/unblock", response_model=SupplierResponse)
async def unblock_supplier(
    id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    try:
        repo = SqlAlchemySupplierRepository(uow.session)
        use_case = UnblockSupplierUseCase(repo)
        await use_case.handle(id)
        await uow.commit()

        stmt = select(SupplierModel).options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact),
            selectinload(SupplierModel.bank_info),
            selectinload(SupplierModel.documents),
        ).where(SupplierModel.id == id)
        res = await uow.session.execute(stmt)
        entity = res.scalar_one_or_none()

        return _response_from_entity(entity)
    except Exception as e:
        logger.error(f"Unblock supplier {id} failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- RFQ ---

@router.post("/rfqs", response_model=RfqResponse, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    request: CreateRfqRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> RfqResponse:
    try:
        repo = SqlAlchemyRfqRepository(uow.session)
        use_case = CreateRfqUseCase(repo)
        command = CreateRfqCommand(
            rfq_date=request.rfq_date,
            warehouse=request.warehouse,
            procurement_officer=request.procurement_officer,
            supplier_ids=request.supplier_ids,
            items=[RfqItemCommand(**item.dict()) for item in request.items],
            material_request_number=request.material_request_number,
            required_delivery_date=request.required_delivery_date,
            remarks=request.remarks,
        )
        rfq_id = await use_case.handle(command)
        await uow.commit()

        # Fetch the model directly with preloaded relationships to get actual supplier names
        stmt = select(RfqModel).options(
            selectinload(RfqModel.items),
            selectinload(RfqModel.suppliers).joinedload(SupplierModel.contact)
        ).where(RfqModel.id == rfq_id.value)
        res = await uow.session.execute(stmt)
        entity = res.scalar_one_or_none()

        return _to_rfq_response(entity)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create RFQ: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create RFQ: {str(e)}")


@router.post("/rfqs/{id}/send")
async def send_rfq_endpoint(
    id: str,
    uow: UnitOfWork = Depends(get_uow)
):
    repo = SqlAlchemyRfqRepository(uow.session)

    try:
        rfq = await repo.get_by_id(RfqId.of(id))
        if not rfq:
            raise NotFoundException(f"RFQ not found: {id}")
        if rfq.status == "DRAFT":
            rfq.send()
            await repo.save(rfq)
            await uow.commit()
        elif rfq.status != "OPEN":
            raise HTTPException(status_code=409, detail=f"Cannot send RFQ in status: {rfq.status}")

        delivery = await _notify_suppliers_rfq(id)
        if delivery["total"] == 0:
            raise HTTPException(status_code=400, detail="No supplier email address is configured for this RFQ")
        if delivery["failed"] > 0:
            raise HTTPException(
                status_code=502,
                detail=f"RFQ saved, but email delivery failed for {delivery['failed']} of {delivery['total']} supplier(s)",
            )
        return {
            "status": "sent",
            "message": f"RFQ email sent successfully to {delivery['sent']} supplier(s).",
            "delivery": delivery,
        }
    except HTTPException:
        raise
    except NotFoundException as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to send RFQ: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def _notify_suppliers_rfq(rfq_id: str):
    """Persist supplier access, then deliver all supplier emails concurrently."""
    from app.database.session import session_scope
    import random
    import string
    import hashlib
    import os

    sent = 0
    failed = 0
    total = 0
    deliveries = []
    async with session_scope() as session:
        # Fetch RFQ with suppliers and their contact info
        stmt = (
            select(RfqModel)
            .options(
                selectinload(RfqModel.suppliers).joinedload(SupplierModel.contact),
                selectinload(RfqModel.items)
            )
            .where(RfqModel.id == rfq_id)
        )
        res = await session.execute(stmt)
        rfq = res.scalar_one_or_none()

        if not rfq:
            logger.error(f"Background notify failed: RFQ {rfq_id} not found")
            return {"total": 0, "sent": 0, "failed": 1}

        for supplier in rfq.suppliers:
            total += 1
            # Check if supplier_user exists
            su_stmt = select(SupplierUserModel).where(SupplierUserModel.supplier_id == supplier.id)
            su_res = await session.execute(su_stmt)
            sup_user = su_res.scalar_one_or_none()

            # Always generate a fresh random temporary password for every quotation request
            chars = string.ascii_letters + string.digits
            temp_password = "".join(random.choices(chars, k=10))
            password_hash = hashlib.sha256(temp_password.encode()).hexdigest()

            if not sup_user:
                # Generate username: supplier_code or clean name
                code = supplier.supplier_code or "".join(c for c in supplier.supplier_name if c.isalnum()).lower()[:10]
                username = f"supplier_{code.lower()}"

                sup_user = SupplierUserModel(
                    id=uuid.uuid4(),
                    supplier_id=supplier.id,
                    username=username,
                    password_hash=password_hash,
                    must_change_password=False,
                )
                session.add(sup_user)
            else:
                username = sup_user.username
                sup_user.password_hash = password_hash
                sup_user.must_change_password = False

            email = None
            if supplier.contact and supplier.contact.primary_email:
                email = supplier.contact.primary_email

            if email:
                subject = f"Request for Quotation - {rfq.rfq_number}"
                
                login_link = f"http://localhost:8080/login?redirect=/submit-quotation?rfqId={rfq.id}"

                body = (
                    f"Dear {supplier.supplier_name},\n\n"
                    f"We request you to submit a quotation through the supplier portal.\n\n"
                    f"Please use the following link to login and submit your quotation:\n\n"
                    f"{login_link}\n\n"
                    f"Your Credentials:\n"
                    f"Username: {username}\n"
                    f"Temporary Password: {temp_password}\n\n"
                    f"Note: This temporary access password was generated for your quotation submission.\n"
                )
                html_body = render_premium_email(
                    eyebrow="Request for quotation",
                    title=f"Quotation requested · {rfq.rfq_number}",
                    greeting=f"Hello {supplier.supplier_name},",
                    intro="You have been invited to submit a commercial quotation. Review the requirements and respond through the secure supplier portal.",
                    credentials=[("Username", username), ("Temporary password", temp_password)],
                    primary_cta=("Review & submit quotation", login_link),
                    note="Please submit your quotation before the RFQ closing date. Pricing and delivery commitments entered in the portal will form part of your official response.",
                )

                # Write mock email to file
                os.makedirs(os.path.join("media_uploads", "emails"), exist_ok=True)
                email_path = os.path.join("media_uploads", "emails", f"rfq_{rfq.rfq_number}_{username}.html")
                try:
                    with open(email_path, "w", encoding="utf-8") as ef:
                        ef.write(html_body)
                except Exception as file_err:
                    logger.error(f"Failed to write mock email file: {file_err}")

                deliveries.append((email, subject, body, html_body))
            else:
                logger.warning(f"No primary email configured for supplier {supplier.id}")
                failed += 1

        # Credentials must be durable before any supplier can receive them.
        await session.commit()
        results = await asyncio.gather(
            *(send_email(email, subject, body, html_body) for email, subject, body, html_body in deliveries),
            return_exceptions=True,
        )
        for delivery, result in zip(deliveries, results):
            email = delivery[0]
            if isinstance(result, Exception) or result is not True:
                logger.error(f"Failed to send RFQ notification to {email}: {result}")
                failed += 1
            else:
                logger.info(f"Sent RFQ notification to {email}")
                sent += 1

    return {"total": total, "sent": sent, "failed": failed}


async def _notify_quotation_submitted(quotation_id: uuid.UUID):
    """Notify the procurement team that a quotation has been received."""
    from app.database.session import session_scope
    async with session_scope() as session:
        # Fetch quotation with related entities
        stmt = (
            select(QuotationModel)
            .options(
                joinedload(QuotationModel.supplier).joinedload(SupplierModel.contact),
                selectinload(QuotationModel.lines)
            )
            .where(QuotationModel.id == quotation_id)
        )
        res = await session.execute(stmt)
        q = res.scalar_one_or_none()

        if not q:
            logger.error(f"Quotation notification failed: {quotation_id} not found")
            return

        # Fetch RFQ separately for context
        rfq_stmt = select(RfqModel).where(RfqModel.id == q.rfq_id)
        rfq_res = await session.execute(rfq_stmt)
        rfq = rfq_res.scalar_one_or_none()

        supplier = q.supplier
        if not supplier:
            logger.warning(f"No supplier found for quotation {q.id}")
            return

        # Notify Procurement Team
        settings = get_settings()
        if settings.email_host_user:
            proc_subject = f"New Quotation Submitted: {rfq.rfq_number if rfq else ''} - {supplier.supplier_name}"
            proc_body = render_premium_email(
                eyebrow="New Submission",
                title="New quotation received",
                greeting="Hello Procurement Team,",
                intro=f"A new quotation has been submitted by {supplier.supplier_name} for RFQ {rfq.rfq_number if rfq else 'N/A'}.",
                details=[
                    ("Supplier", supplier.supplier_name),
                    ("RFQ", rfq.rfq_number if rfq else "N/A"),
                    ("Total Amount", f"{q.total_amount:,.2f}")
                ],
                primary_cta=("View Quotations", f"http://localhost:8080/procurement/rfqs/{q.rfq_id}")
            )
            await _send_email_logged(settings.email_host_user, proc_subject, "New quotation submitted.", proc_body, "Procurement Notification")


async def _send_email_logged(to_email: str, subject: str, body: str, html_body: str, context: str) -> None:
    """Background delivery boundary: failures are logged without delaying the API response."""
    try:
        delivered = await send_email(to_email, subject, body, html_body)
        if delivered:
            logger.info(f"{context} email delivered to {to_email}")
        else:
            logger.error(f"{context} email skipped because SMTP is not configured")
    except Exception as error:
        logger.error(f"{context} email delivery failed for {to_email}: {error}", exc_info=True)


@router.post("/rfqs/{rfq_id}/select-supplier")
async def select_supplier(rfq_id: str, request: SupplierSelectionRequest, uow: UnitOfWork = Depends(get_uow), _user: CurrentUser = Depends(get_current_user)):
    try:
        rfq_uuid = uuid.UUID(rfq_id)
        supplier_id = request.supplier_id
        supplier_uuid = supplier_id

        stmt = select(RfqModel).options(selectinload(RfqModel.items)).where(RfqModel.id == rfq_uuid)
        res = await uow.session.execute(stmt)
        rfq = res.scalar_one_or_none()
        if not rfq:
            raise HTTPException(status_code=404, detail="RFQ not found")

        # Check if this specific supplier was already selected for this RFQ to avoid duplicates
        existing_po_result = await uow.session.execute(
            select(PurchaseOrderModel)
            .where(
                PurchaseOrderModel.rfq_id == rfq_uuid,
                PurchaseOrderModel.supplier_id == supplier_uuid,
                PurchaseOrderModel.status != "REJECTED",
            )
            .limit(1)
        )
        existing_po = existing_po_result.scalar_one_or_none()
        if existing_po:
            return {
                "status": "already_saved",
                "po_number": existing_po.po_number,
                "po_id": str(existing_po.id),
            }

        rfq.selected_supplier_id = supplier_uuid
        rfq.selection_reason = request.selection_reason
        rfq.selection_comments = request.selection_comments
        rfq.status = "CLOSED"

        # Automatically generate a Purchase Order Proposal
        supplier_stmt = select(SupplierModel).options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact)
        ).where(SupplierModel.id == supplier_uuid)
        s_res = await uow.session.execute(supplier_stmt)
        supplier = s_res.scalar_one_or_none()

        # Get the latest quotation to get prices
        quo_stmt = select(QuotationModel).options(selectinload(QuotationModel.lines)).where(
            QuotationModel.rfq_id == rfq_uuid,
            QuotationModel.supplier_id == supplier_uuid
        ).order_by(QuotationModel.created_at.desc()).limit(1)
        q_res = await uow.session.execute(quo_stmt)
        quotation = q_res.scalars().first()

        import random
        # Proposals use PROP- prefix until approved by Finance
        po_number = f"PROP-{datetime.now().strftime('%Y%m%d')}-{random.randint(1000, 9999)}"

        # Quotation.tax stores the GST rate, not a currency amount. Derive the
        # monetary figures once from the supplier's quotation for finance.
        quoted_line_total = (
            sum((line.quantity * line.unit_price for line in quotation.lines), Decimal("0.0"))
            if quotation
            else Decimal("0.0")
        )
        quoted_discount = quotation.discount or Decimal("0.0") if quotation else Decimal("0.0")
        quoted_tax_rate = quotation.tax or Decimal("0.0") if quotation else Decimal("0.0")
        quoted_freight = quotation.freight_charges or Decimal("0.0") if quotation else Decimal("0.0")
        quoted_taxable_amount = quoted_line_total - quoted_discount
        quoted_tax_amount = (
            quoted_taxable_amount * (quoted_tax_rate / Decimal("100"))
            if quoted_tax_rate > 0
            else Decimal("0.0")
        )
        quoted_total_amount = quoted_taxable_amount + quoted_tax_amount + quoted_freight

        # Material Request for Department lookup
        mr_dept = "Procurement"
        if rfq.material_request_number:
            mr_stmt = select(MaterialRequestModel).where(MaterialRequestModel.request_number == rfq.material_request_number)
            mr_res = await uow.session.execute(mr_stmt)
            mr_obj = mr_res.scalar_one_or_none()
            if mr_obj:
                mr_dept = mr_obj.department

        new_po = PurchaseOrderModel(
            id=uuid.uuid4(),
            po_number=po_number,
            rfq_id=rfq.id,
            supplier_id=supplier_uuid,
            supplier_name=supplier.supplier_name if supplier else "Unknown",
            supplier_code=supplier.supplier_code if supplier else None,
            supplier_contact_person=supplier.contact.primary_contact_name if supplier and supplier.contact else None,
            supplier_phone=supplier.contact.phone if supplier and supplier.contact else None,
            supplier_email=supplier.contact.primary_email if supplier and supplier.contact else None,
            supplier_gstin=supplier.gstin if supplier else None,
            supplier_address=supplier.address.registered_address if supplier and supplier.address else None,
            warehouse_id=rfq.warehouse,
            delivery_warehouse_name=rfq.warehouse,
            delivery_address="Main Industrial Area, Phase 2, Pune, MH", # Default warehouse address
            department=mr_dept,
            status="PENDING_FINANCE",
            total_amount=quoted_total_amount,
            subtotal=quoted_line_total,
            discount_amount=quoted_discount,
            tax_amount=quoted_tax_amount,
            freight_charges=quoted_freight,
            additional_charges=Decimal("0.0"),
            expected_delivery_date=rfq.required_delivery_date,
            payment_terms=quotation.payment_terms,
            procurement_officer=rfq.procurement_officer,
            selection_reason=request.selection_reason,
            procurement_comments=request.selection_comments,
            selected_by=_user.username
        )

        # Add to history
        new_po.history.append(POApprovalHistoryModel(
            id=uuid.uuid4(),
            status="SUBMITTED",
            actor_name=_user.username,
            comments="Proposal submitted for Finance Approval"
        ))

        # Create Notification for Finance
        uow.session.add(NotificationModel(
            id=uuid.uuid4(),
            user_role="FINANCE",
            title="New PO Proposal",
            message=f"Purchase Order {po_number} submitted by Procurement for approval.",
            link=f"/finance/approvals/{new_po.id}"
        ))

        po_item_values = []
        for item in rfq.items:
            # Find price from quotation if exists
            price = Decimal("0.0")
            if quotation:
                q_line = next((l for l in quotation.lines if l.item_code == item.material_code), None)
                if q_line:
                    price = q_line.unit_price

            po_item_values.append((item, price, item.quantity * price))

        material_codes = [item.material_code for item, _, _ in po_item_values]
        threshold_result = await uow.session.execute(
            select(MaterialModel).where(MaterialModel.code.in_(material_codes))
        )
        threshold_by_code = {material.code: material for material in threshold_result.scalars().all()}
        threshold_breaches = []
        today = date.today()
        for item, price, _ in po_item_values:
            threshold = threshold_by_code.get(item.material_code)
            if not threshold or threshold.price_threshold_status.lower() != "active":
                continue
            if threshold.price_effective_from and today < threshold.price_effective_from:
                continue
            if threshold.price_effective_to and today > threshold.price_effective_to:
                continue
            below = threshold.minimum_price is not None and price < threshold.minimum_price
            above = threshold.maximum_price is not None and price > threshold.maximum_price
            if below or above:
                threshold_breaches.append(
                    f"{item.material_code}: entered {threshold.currency} {price}, "
                    f"approved {threshold.minimum_price or '-'} to {threshold.maximum_price or '-'} "
                    f"(standard {threshold.standard_price or '-'})"
                )

        if threshold_breaches:
            variance_note = "Price threshold exceeded. " + "; ".join(threshold_breaches)
            new_po.selection_reason = f"{request.selection_reason}\n{variance_note}"
            new_po.history.append(POApprovalHistoryModel(
                id=uuid.uuid4(), status="PRICE_VARIANCE_REVIEW",
                actor_name=_user.username, comments=variance_note,
            ))
            uow.session.add(NotificationModel(
                id=uuid.uuid4(), user_role="FINANCE", title="PO price variance requires approval",
                message=f"Purchase Order {po_number} contains {len(threshold_breaches)} out-of-range line(s).",
                link=f"/finance/approvals/{new_po.id}",
            ))

        total_line_value = sum((line_total for _, _, line_total in po_item_values), Decimal("0.0"))
        remaining_discount = quoted_discount
        remaining_tax = quoted_tax_amount

        for index, (item, price, line_total) in enumerate(po_item_values):
            # The quotation discount is supplied at quotation level. Allocate it across
            # PO lines so every finance view and the generated PO show the same total.
            if index == len(po_item_values) - 1:
                line_discount = remaining_discount
            elif total_line_value > 0:
                line_discount = (quoted_discount * line_total / total_line_value).quantize(Decimal("0.0001"))
                remaining_discount -= line_discount
            else:
                line_discount = Decimal("0.0")

            if index == len(po_item_values) - 1:
                line_tax = remaining_tax
            elif total_line_value > 0:
                line_tax = (quoted_tax_amount * line_total / total_line_value).quantize(Decimal("0.0001"))
                remaining_tax -= line_tax
            else:
                line_tax = Decimal("0.0")

            new_po.items.append(PurchaseOrderItemModel(
                id=uuid.uuid4(),
                material_code=item.material_code,
                material_name=item.material_name,
                category=item.category,
                quantity=item.quantity,
                unit_price=price,
                discount=line_discount,
                tax=line_tax,
                uom=item.uom
            ))

        uow.session.add(new_po)

        # Mark winning quotation as Selected
        if quotation:
            quotation.status = "Selected"
            audit_note = f"Selected by {_user.username}: {request.selection_reason}"
            if request.selection_comments:
                audit_note = f"{audit_note}\n{request.selection_comments}"
            quotation.remarks = f"{quotation.remarks}\n{audit_note}" if quotation.remarks else audit_note

        await uow.commit()
        await uow.session.refresh(new_po)

        logger.info(f"PO {po_number} created and committed successfully.")
        return {"status": "success", "po_number": po_number, "po_id": str(new_po.id)}
    except HTTPException:
        raise
    except ValueError as ve:
        logger.error(f"Invalid UUID in selection: {ve}")
        raise HTTPException(status_code=400, detail="Invalid RFQ or Supplier ID format")
    except Exception as e:
        logger.error(f"Selection finalization failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    search: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow)
):
    try:
        repo = SqlAlchemyPurchaseOrderRepository(uow.session)
        # Using model directly to get history
        stmt = select(PurchaseOrderModel).options(
            selectinload(PurchaseOrderModel.items),
            selectinload(PurchaseOrderModel.history),
            selectinload(PurchaseOrderModel.rfq),
        )

        if search:
            search_term = f"%{search}%"
            stmt = stmt.where(
                or_(
                    PurchaseOrderModel.po_number.ilike(search_term),
                    PurchaseOrderModel.supplier_name.ilike(search_term),
                    PurchaseOrderModel.department.ilike(search_term)
                )
            )

        stmt = stmt.order_by(PurchaseOrderModel.created_at.desc())
        res = await uow.session.execute(stmt)
        entities = res.scalars().all()
        logger.info(f"Retrieved {len(entities)} purchase orders from DB")
        return [_to_po_response(e) for e in entities]
    except Exception as e:
        logger.error(f"List POs failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/purchase-orders/{id}/pdf")
async def download_purchase_order_pdf(id: str, uow: UnitOfWork = Depends(get_uow)):
    try:
        po_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid purchase order ID")

    result = await uow.session.execute(
        select(PurchaseOrderModel)
        .options(selectinload(PurchaseOrderModel.items))
        .where(PurchaseOrderModel.id == po_id)
    )
    po = result.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")

    buffer = BytesIO()
    styles = getSampleStyleSheet()
    right_style = ParagraphStyle("Right", parent=styles["BodyText"], alignment=TA_RIGHT, fontSize=9, leading=13)
    section_style = ParagraphStyle(
        "PoSection", parent=styles["Heading2"], fontSize=11, leading=14,
        textColor=colors.HexColor("#172554"), spaceBefore=12, spaceAfter=6,
    )
    label_style = ParagraphStyle(
        "PoLabel", parent=styles["BodyText"], fontSize=7.5, leading=9,
        textColor=colors.HexColor("#64748b"),
    )
    value_style = ParagraphStyle(
        "PoValue", parent=styles["BodyText"], fontSize=9, leading=12,
        textColor=colors.HexColor("#0f172a"),
    )
    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=15 * mm,
        bottomMargin=15 * mm,
        title=f"Purchase Order {po.po_number}",
    )

    status_text = escape(str(po.status or "DRAFT").replace("_", " ").title())
    header = Table(
        [[
            Paragraph('<b><font color="#ffffff" size="19">NEXUSWMS</font></b><br/><font color="#bfdbfe" size="8">PROCUREMENT • PURCHASE ORDER</font>', styles["BodyText"]),
            Paragraph(
                f'<para alignment="right"><font color="#fbbf24" size="8"><b>TAX INVOICE</b></font><br/><font color="#ffffff" size="15"><b>{escape(str(po.po_number))}</b></font><br/><font color="#dbeafe" size="8">Order placed: {escape(str(po.po_date or date.today()))}</font></para>',
                styles["BodyText"],
            ),
        ]],
        colWidths=[95 * mm, 85 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#172554")),
            ("LINEBELOW", (0, 0), (-1, -1), 4, colors.HexColor("#f59e0b")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 14),
            ("RIGHTPADDING", (0, 0), (-1, -1), 14),
            ("TOPPADDING", (0, 0), (-1, -1), 14),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 14),
        ]),
    )

    story = [
        header,
        Spacer(1, 6 * mm),
        Table(
            [[
                Paragraph(f'<font color="#64748b" size="7">ORDER DATE</font><br/><b>{escape(str(po.po_date or "-"))}</b>', value_style),
                Paragraph(f'<font color="#64748b" size="7">EXPECTED DELIVERY</font><br/><b>{escape(str(po.expected_delivery_date or "-"))}</b>', value_style),
                Paragraph(f'<font color="#64748b" size="7">ORDER STATUS</font><br/><b>{status_text}</b>', value_style),
                Paragraph(f'<font color="#64748b" size="7">PAYMENT TERMS</font><br/><b>{escape(str(po.payment_terms or "Not specified"))}</b>', value_style),
            ]],
            colWidths=[45 * mm, 45 * mm, 45 * mm, 45 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe3ee")),
                ("INNERGRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#dbe3ee")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]),
        ),
        Paragraph("Billing and delivery", section_style),
        Table(
            [
                [Paragraph("<b>Bill to</b>", label_style), Paragraph(escape(str(po.supplier_name or "-")), value_style), Paragraph("<b>Ship to</b>", label_style), Paragraph(escape(str(po.delivery_warehouse_name or po.warehouse_id or "-")), value_style)],
                [Paragraph("<b>Supplier address</b>", label_style), Paragraph(escape(str(po.supplier_address or "-")), value_style), Paragraph("<b>Delivery address</b>", label_style), Paragraph(escape(str(po.delivery_address or "-")), value_style)],
                [Paragraph("<b>Procurement officer</b>", label_style), Paragraph(escape(str(po.procurement_officer or "-")), value_style), Paragraph("<b>Department</b>", label_style), Paragraph(escape(str(po.department or "-")), value_style)],
                [Paragraph("<b>Supplier contact</b>", label_style), Paragraph(escape(str(po.supplier_contact_person or "-")), value_style), Paragraph("<b>Expected delivery</b>", label_style), Paragraph(escape(str(po.expected_delivery_date or "-")), value_style)],
            ],
            colWidths=[35 * mm, 55 * mm, 35 * mm, 55 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#fff7ed")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#eff6ff")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("LEADING", (0, 0), (-1, -1), 10),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]),
        ),
        Spacer(1, 7 * mm),
    ]

    item_rows = [["#", "Material", "Description", "Qty", "UOM", "Unit Price", "Line Total"]]
    calc_subtotal = Decimal("0.0")
    line_discount_total = Decimal("0.0")
    calc_tax = Decimal("0.0")

    for index, item in enumerate(po.items, start=1):
        # Calculate line values
        line_gross = item.quantity * item.unit_price
        line_disc = getattr(item, "discount", Decimal("0.0"))
        line_tax = getattr(item, "tax", Decimal("0.0"))
        line_total = line_gross - line_disc + line_tax

        # Accumulate totals
        calc_subtotal += line_gross
        line_discount_total += line_disc
        calc_tax += line_tax

        item_rows.append([
            str(index),
            item.material_code,
            item.material_name or "-",
            f"{item.quantity:,.2f}",
            item.uom,
            f"{item.unit_price:,.2f}",
            f"{line_total:,.2f}",
        ])

    # Final totals including header-level charges
    calc_freight = po.freight_charges or Decimal("0.0")
    calc_additional = po.additional_charges or Decimal("0.0")
    # Use the supplier's quotation-level discount stored on the PO. Older POs may
    # not have per-line allocations, so this remains the single source of truth.
    calc_discount = po.discount_amount if po.discount_amount is not None else line_discount_total
    calc_grand_total = calc_subtotal - calc_discount + calc_tax + calc_freight + calc_additional

    story.append(Paragraph("Items in this order", section_style))
    story.append(Table(
        item_rows,
        repeatRows=1,
        colWidths=[8 * mm, 25 * mm, 53 * mm, 20 * mm, 15 * mm, 27 * mm, 32 * mm],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#172554")),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
            ("ALIGN", (3, 1), (3, -1), "RIGHT"),
            ("ALIGN", (5, 1), (-1, -1), "RIGHT"),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("PADDING", (0, 0), (-1, -1), 5),
        ]),
    ))

    # Currency format helper
    def fmt(val): return f"INR {val:,.2f}"

    discount_percent = (calc_discount / calc_subtotal * Decimal("100")) if calc_subtotal else Decimal("0")
    taxable_amount = calc_subtotal - calc_discount
    tax_percent = (calc_tax / taxable_amount * Decimal("100")) if taxable_amount else Decimal("0")
    summary_rows = [
        [Paragraph("Order summary", section_style), ""],
        ["Subtotal", fmt(calc_subtotal)],
        [f"Discount ({discount_percent:.2f}%)", f"- {fmt(calc_discount)}"],
        [f"GST ({tax_percent:.2f}%)", fmt(calc_tax)],
        ["Freight charges", fmt(calc_freight)],
        ["Additional charges", fmt(calc_additional)],
        ["GRAND TOTAL", fmt(calc_grand_total)],
    ]
    story.extend([
        Spacer(1, 6 * mm),
        Table(
            summary_rows,
            colWidths=[50 * mm, 45 * mm],
            hAlign="RIGHT",
            style=TableStyle([
                ("SPAN", (0, 0), (-1, 0)),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#fff7ed")),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#fef3c7")),
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("TEXTCOLOR", (0, -1), (-1, -1), colors.HexColor("#92400e")),
                ("ALIGN", (1, 1), (1, -1), "RIGHT"),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e1")),
                ("FONTNAME", (0, 1), (-1, -2), "Helvetica"),
                ("FONTSIZE", (0, 1), (-1, -1), 8.5),
                ("PADDING", (0, 0), (-1, -1), 6),
            ]),
        ),
        Paragraph("Supplier and delivery instructions", section_style),
        Table(
            [
                [Paragraph("<b>Payment terms</b><br/>" + escape(str(po.payment_terms or "Not specified")), value_style),
                 Paragraph("<b>Procurement officer</b><br/>" + escape(str(po.procurement_officer or "Not specified")), value_style)],
                [Paragraph("<b>Selection reason</b><br/>" + escape(str(po.selection_reason or "Not specified")), value_style),
                 Paragraph("<b>Procurement comments</b><br/>" + escape(str(po.procurement_comments or "No additional comments")), value_style)],
            ],
            colWidths=[90 * mm, 90 * mm],
            style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
                ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
                ("INNERGRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("PADDING", (0, 0), (-1, -1), 8),
            ]),
        ),
    ])

    def draw_page(canvas, doc):
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#cbd5e1"))
        canvas.line(15 * mm, 11 * mm, A4[0] - 15 * mm, 11 * mm)
        canvas.setFillColor(colors.HexColor("#64748b"))
        canvas.setFont("Helvetica", 7)
        canvas.drawString(15 * mm, 7 * mm, f"NexusWMS • Purchase Order {po.po_number}")
        canvas.drawRightString(A4[0] - 15 * mm, 7 * mm, f"Page {doc.page}")
        canvas.restoreState()

    document.build(story, onFirstPage=draw_page, onLaterPages=draw_page)

    filename = f"PO-{po.po_number}.pdf".replace('"', "")
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition"
        },
    )


@router.get("/purchase-orders/by-number/{po_number}", response_model=PurchaseOrderResponse)
async def get_purchase_order_by_number(po_number: str, uow: UnitOfWork = Depends(get_uow)):
    try:
        stmt = select(PurchaseOrderModel).options(
            selectinload(PurchaseOrderModel.items),
            selectinload(PurchaseOrderModel.history)
        ).where(PurchaseOrderModel.po_number == po_number)
        res = await uow.session.execute(stmt)
        po = res.scalar_one_or_none()

        if not po:
            raise HTTPException(status_code=404, detail=f"Purchase Order {po_number} not found")

        return _to_po_response(po)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch PO by number {po_number}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/purchase-orders/{id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(id: str, uow: UnitOfWork = Depends(get_uow)):
    stmt = select(PurchaseOrderModel).options(
        selectinload(PurchaseOrderModel.items),
        selectinload(PurchaseOrderModel.history)
    ).where(PurchaseOrderModel.id == uuid.UUID(id))
    res = await uow.session.execute(stmt)
    po = res.scalar_one_or_none()
    if not po:
        raise HTTPException(status_code=404, detail="Purchase Order not found")
    return _to_po_response(po)


@router.get("/finance-approvals", response_model=List[PurchaseOrderResponse])
async def list_finance_approvals(uow: UnitOfWork = Depends(get_uow)):
    stmt = select(PurchaseOrderModel).options(
        selectinload(PurchaseOrderModel.items),
        selectinload(PurchaseOrderModel.history),
        joinedload(PurchaseOrderModel.rfq)
    ).where(PurchaseOrderModel.status == "PENDING_FINANCE").order_by(PurchaseOrderModel.created_at.desc())
    res = await uow.session.execute(stmt)
    entities = res.scalars().all()
    return [_to_po_response(e) for e in entities]


@router.post("/purchase-orders/{id}/approve")
async def approve_purchase_order(id: str, uow: UnitOfWork = Depends(get_uow), _user: CurrentUser = Depends(get_current_user)):
    try:
        logger.info(f"Attempting to approve PO ID: {id}")
        stmt = (
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.history))
            .where(PurchaseOrderModel.id == uuid.UUID(id))
        )
        res = await uow.session.execute(stmt)
        po = res.scalar_one_or_none()
        if not po:
            logger.error(f"PO with ID {id} not found")
            raise HTTPException(status_code=404, detail="PO not found")

        # Generate formal PO Number: PO-YYYY-XXXX
        year = datetime.now().year
        # Count all issued POs (Approved, Sent, etc.) to ensure unique sequencing
        count_stmt = select(func.count(PurchaseOrderModel.id)).where(
            PurchaseOrderModel.po_number.like(f"PO-{year}-%")
        )
        count_res = await uow.session.execute(count_stmt)
        seq = (count_res.scalar() or 0) + 1
        formal_po_number = f"PO-{year}-{seq:04d}"
        logger.info(f"Generated formal PO number: {formal_po_number}")

        po.status = "APPROVED"
        po.po_number = formal_po_number

        po.history.append(POApprovalHistoryModel(
            id=uuid.uuid4(),
            status="APPROVED",
            actor_name=_user.username or "system",
            comments="Purchase Order approved by Finance"
        ))

        # Create Notification for Procurement
        notif = NotificationModel(
            id=uuid.uuid4(),
            user_role="PROCUREMENT",
            title="PO Approved",
            message=f"Purchase Order {formal_po_number} has been approved by Finance.",
            link=f"/purchase-order?poId={po.id}"
        )
        uow.session.add(notif)

        await uow.commit()
        logger.info(f"PO {formal_po_number} committed successfully.")
        return {"status": "success", "po_number": formal_po_number}
    except Exception as e:
        logger.error(f"CRITICAL: Approval failed for PO {id}: {e}", exc_info=True)
        # Rollback is handled by UnitOfWork context manager or session
        raise HTTPException(status_code=500, detail=f"Approval failed: {str(e)}")


@router.post("/purchase-orders/{id}/reject")
async def reject_purchase_order(id: str, request: dict, uow: UnitOfWork = Depends(get_uow), _user: CurrentUser = Depends(get_current_user)):
    try:
        stmt = (
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.history))
            .where(PurchaseOrderModel.id == uuid.UUID(id))
        )
        res = await uow.session.execute(stmt)
        po = res.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="PO not found")

        reason = request.get("reason")
        if not reason:
            raise HTTPException(status_code=400, detail="Rejection reason is mandatory")

        po.status = "REJECTED"
        po.rejection_reason = reason

        po.history.append(POApprovalHistoryModel(
            id=uuid.uuid4(),
            status="REJECTED",
            actor_name=_user.username or "system",
            comments=f"Rejected by Finance: {reason}"
        ))

        # Create Notification for Procurement
        uow.session.add(NotificationModel(
            id=uuid.uuid4(),
            user_role="PROCUREMENT",
            title="PO Rejected",
            message=f"Purchase Order {po.po_number} was rejected by Finance. Reason: {reason}",
            link=f"/purchase-order?poId={po.id}"
        ))

        await uow.commit()
        logger.info(f"PO {po.po_number} rejected successfully.")
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Rejection failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Rejection failed: {str(e)}")


@router.post("/purchase-orders/{id}/send-to-supplier")
async def send_po_to_supplier(id: str, uow: UnitOfWork = Depends(get_uow), _user: CurrentUser = Depends(get_current_user)):
    try:
        try:
            po_id = uuid.UUID(id)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid purchase order ID")

        stmt = (
            select(PurchaseOrderModel)
            .options(
                selectinload(PurchaseOrderModel.items),
                selectinload(PurchaseOrderModel.history)
            )
            .where(PurchaseOrderModel.id == po_id)
        )
        res = await uow.session.execute(stmt)
        po = res.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="PO not found")

        if po.status not in {"APPROVED", "SENT"}:
            raise HTTPException(status_code=400, detail="Only approved or previously sent POs can be sent to suppliers")

        is_resend = po.status == "SENT"

        recipient_email = (po.supplier_email or "").strip()
        if not recipient_email:
            raise HTTPException(
                status_code=400,
                detail="Supplier email address is missing. Add an email address before sending the PO.",
            )

        # Ensure supplier user exists for portal access
        import hashlib
        import string
        import random

        def generate_password(length=10):
            chars = string.ascii_letters + string.digits
            return ''.join(random.choice(chars) for _ in range(length))

        # Check if supplier_user exists
        su_stmt = select(SupplierUserModel).where(SupplierUserModel.supplier_id == po.supplier_id)
        su_res = await uow.session.execute(su_stmt)
        sup_user = su_res.scalar_one_or_none()

        temp_password = generate_password()
        password_hash = hashlib.sha256(temp_password.encode()).hexdigest()

        if not sup_user:
            username = f"sup_{po.supplier_code.lower().replace('-', '_') if po.supplier_code else str(po.supplier_id)[:8]}"
            sup_user = SupplierUserModel(
                id=uuid.uuid4(),
                supplier_id=po.supplier_id,
                username=username,
                password_hash=password_hash,
                must_change_password=False
            )
            uow.session.add(sup_user)
        else:
            username = sup_user.username
            sup_user.password_hash = password_hash
            sup_user.must_change_password = False

        creds_section = (
            f"Username: {username}\n"
            f"Temporary Password: {temp_password}\n\n"
            f"Note: For security, you will be required to change this password upon your first login.\n"
        )

        # Email Logic
        subject = f"Purchase Order {po.po_number}"

        asn_link = f"http://localhost:8080/login?redirect=/supplier/asns/new?poId={po.id}"
        view_link = f"http://localhost:8080/purchase-order?poId={po.id}"

        total_val = float(po.total_amount) if po.total_amount else 0.0

        body = (
            f"Dear {po.supplier_name},\n\n"
            f"Your Purchase Order has been approved and issued.\n\n"
            f"PO Number: {po.po_number}\n"
            f"Total Amount: ₹ {total_val:,.2f}\n"
            f"Expected Delivery: {po.expected_delivery_date or 'As per terms'}\n\n"
            f"{creds_section}\n"
            f"You can view the full PO details here:\n{view_link}\n\n"
            f"Once the shipment is ready, please login and submit the Advance Shipping Notice (ASN) here:\n{asn_link}\n\n"
            f"Regards,\n{po.procurement_officer or 'Procurement Team'}\nNexusWMS"
        )
        html_body = render_premium_email(
            eyebrow="Purchase order issued",
            title="Your purchase order is ready",
            greeting=f"Hello {po.supplier_name},",
            intro="Your purchase order has been approved and officially issued. Prepare the shipment using the supplier portal.",
            credentials=[("Username", username), ("Temporary password", temp_password)],
            primary_cta=("Create advance shipping notice", asn_link),
            secondary_cta=("View purchase order", view_link),
            note="Submit the Advance Shipping Notice before dispatch so the warehouse and gate teams can prepare for your arrival.",
            signoff=po.procurement_officer or "NexusWMS Procurement Team",
        )

        # Mock email persistence
        os.makedirs(os.path.join("media_uploads", "emails"), exist_ok=True)
        email_path = os.path.join("media_uploads", "emails", f"po_issued_{po.po_number}.html")
        try:
            with open(email_path, "w", encoding="utf-8") as f:
                f.write(html_body)
        except Exception as fe:
            logger.error(f"Failed to write mock PO email: {fe}")

        # Wait for the SMTP server to accept the message. Do not mark the PO as
        # sent or persist newly generated credentials on a failed delivery.
        delivered = await send_email(recipient_email, subject, body, html_body)
        if delivered is not True:
            raise HTTPException(status_code=503, detail="SMTP is not configured; purchase order email was not sent")

        po.status = "SENT"
        po.history.append(POApprovalHistoryModel(
            id=uuid.uuid4(),
            status="SENT",
            actor_name=_user.username or "system",
            comments=f"Purchase Order {'resent' if is_resend else 'sent'} to supplier at {recipient_email}"
        ))

        await uow.commit()
        return {
            "status": "sent",
            "message": f"Purchase Order {'resent' if is_resend else 'sent'} successfully to {recipient_email}.",
            "recipient": recipient_email,
            "resent": is_resend,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Send to supplier failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/purchase-orders/{id}/resubmit")
async def resubmit_purchase_order(id: str, request: dict, uow: UnitOfWork = Depends(get_uow), _user: CurrentUser = Depends(get_current_user)):
    try:
        stmt = (
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.history))
            .where(PurchaseOrderModel.id == uuid.UUID(id))
        )
        res = await uow.session.execute(stmt)
        po = res.scalar_one_or_none()
        if not po:
            raise HTTPException(status_code=404, detail="PO not found")

        if po.status != "REJECTED":
            raise HTTPException(status_code=400, detail="Only rejected POs can be resubmitted")

        # Update any fields provided
        if "total_amount" in request:
            po.total_amount = Decimal(str(request["total_amount"]))
        if "expected_delivery_date" in request:
            po.expected_delivery_date = datetime.strptime(request["expected_delivery_date"], '%Y-%m-%d').date()

        po.status = "PENDING_FINANCE"
        po.history.append(POApprovalHistoryModel(
            id=uuid.uuid4(),
            status="RESUBMITTED",
            actor_name=_user.username or "system",
            comments="Modified and resubmitted for approval"
        ))

        # Create Notification for Finance
        uow.session.add(NotificationModel(
            id=uuid.uuid4(),
            user_role="FINANCE",
            title="PO Resubmitted",
            message=f"Purchase Order {po.po_number} has been resubmitted after changes.",
            link=f"/finance/approvals/{po.id}"
        ))

        await uow.commit()
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Resubmit failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Resubmit failed: {str(e)}")


def _to_po_response(po: PurchaseOrderModel) -> PurchaseOrderResponse:
    # Populate rfq_number if relationship is loaded
    rfq_number = None
    try:
        from sqlalchemy import inspect
        state = inspect(po)
        if state and "rfq" not in state.unloaded:
            if po.rfq:
                rfq_number = po.rfq.rfq_number
    except Exception as e:
        logger.warning(f"Could not load rfq_number for PO {po.id}: {e}")

    return PurchaseOrderResponse(
        id=str(po.id),
        po_number=po.po_number,
        po_date=po.po_date or date.today(),
        status=po.status,
        rfq_id=str(po.rfq_id) if po.rfq_id else None,
        rfq_number=rfq_number,
        supplier_id=str(po.supplier_id),
        supplier_name=po.supplier_name,
        supplier_code=getattr(po, "supplier_code", None),
        supplier_contact_person=getattr(po, "supplier_contact_person", None),
        supplier_phone=getattr(po, "supplier_phone", None),
        supplier_email=getattr(po, "supplier_email", None),
        supplier_gstin=getattr(po, "supplier_gstin", None),
        supplier_address=getattr(po, "supplier_address", None),
        warehouse_id=po.warehouse_id,
        delivery_warehouse_name=getattr(po, "delivery_warehouse_name", None),
        delivery_address=getattr(po, "delivery_address", None),
        department=getattr(po, "department", None),
        total_amount=po.total_amount or Decimal("0.0"),
        subtotal=getattr(po, "subtotal", Decimal("0.0")),
        discount_amount=getattr(po, "discount_amount", Decimal("0.0")),
        tax_amount=getattr(po, "tax_amount", Decimal("0.0")),
        freight_charges=getattr(po, "freight_charges", Decimal("0.0")),
        additional_charges=getattr(po, "additional_charges", Decimal("0.0")),
        expected_delivery_date=po.expected_delivery_date,
        payment_terms=getattr(po, "payment_terms", None),
        procurement_officer=getattr(po, "procurement_officer", None),
        selection_reason=getattr(po, "selection_reason", None),
        procurement_comments=getattr(po, "procurement_comments", None),
        selected_by=getattr(po, "selected_by", None),
        rejection_reason=getattr(po, "rejection_reason", None),
        items=[
            PurchaseOrderItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                category=getattr(it, "category", None),
                quantity=it.quantity,
                unit_price=it.unit_price,
                discount=getattr(it, "discount", Decimal("0.0")),
                tax=getattr(it, "tax", Decimal("0.0")),
                uom=it.uom
            )
            for it in po.items
        ],
        history=[
            POApprovalHistorySchema(
                status=h.status,
                actor_name=h.actor_name,
                comments=h.comments,
                created_at=h.created_at
            )
            for h in (po.history or [])
        ],
        created_at=po.created_at or datetime.now()
    )


@router.get("/rfqs", response_model=List[RfqResponse])
async def list_rfqs(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[RfqResponse]:
    stmt = select(RfqModel).options(
        selectinload(RfqModel.items),
        selectinload(RfqModel.suppliers).joinedload(SupplierModel.contact)
    ).order_by(RfqModel.created_at.desc())
    res = await uow.session.execute(stmt)
    entities = res.scalars().all()
    return [_to_rfq_response(e) for e in entities]


@router.get("/rfqs/{id}", response_model=RfqResponse)
async def get_rfq(
    id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> RfqResponse:
    stmt = select(RfqModel).options(
        selectinload(RfqModel.items),
        selectinload(RfqModel.suppliers).joinedload(SupplierModel.contact)
    ).where(RfqModel.id == id)
    res = await uow.session.execute(stmt)
    entity = res.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="RFQ not found")
    return _to_rfq_response(entity)


def _to_rfq_response(rfq) -> RfqResponse:
    items = []
    for item in rfq.items:
        if hasattr(item, "__dict__"):
            data = {k: v for k, v in item.__dict__.items() if not k.startswith('_')}
        else:
            # Fallback for dataclasses or objects without __dict__ if any
            data = {
                "material_code": item.material_code,
                "material_name": item.material_name,
                "category": item.category,
                "quantity": item.quantity,
                "uom": item.uom,
                "required_delivery_date": item.required_delivery_date,
                "warehouse": item.warehouse,
                "special_requirements": item.special_requirements
            }
        items.append(RfqItemSchema(**data))

    suppliers_list = []
    supplier_emails = []
    # Check for suppliers in model or domain object
    suppliers = getattr(rfq, "suppliers", [])
    if not suppliers:
        # Fallback to supplier_ids if it's a domain object
        supplier_ids = getattr(rfq, "supplier_ids", [])
        for sid in supplier_ids:
            suppliers_list.append(SupplierResponse(
                supplier_id=str(sid),
                supplier_name="Supplier"
            ))
    else:
        for s in suppliers:
            try:
                s_resp = _response_from_entity(s)
                suppliers_list.append(s_resp)

                # Ensure we collect the email if available in the response mapping
                if s_resp.contact and s_resp.contact.primary_email:
                    if s_resp.contact.primary_email not in supplier_emails:
                        supplier_emails.append(s_resp.contact.primary_email)
            except Exception as e:
                logger.warning(f"Failed to map supplier {getattr(s, 'id', 'unknown')} in RFQ response: {e}")
                suppliers_list.append(SupplierResponse(
                    supplier_id=str(s.id),
                    supplier_name=getattr(s, "supplier_name", "Unknown")
                ))

    return RfqResponse(
        id=str(rfq.id),
        rfq_number=getattr(rfq, "rfq_number", None),
        rfq_date=getattr(rfq, "rfq_date", None),
        status=getattr(rfq, "status", None),
        material_request_number=getattr(rfq, "material_request_number", None),
        required_delivery_date=getattr(rfq, "required_delivery_date", None),
        warehouse=getattr(rfq, "warehouse", None),
        procurement_officer=getattr(rfq, "procurement_officer", None),
        remarks=getattr(rfq, "remarks", None),
        items=items,
        suppliers=suppliers_list,
        supplier_emails=supplier_emails,
        created_at=getattr(rfq, "created_at", None),
    )


# --- Quotation ---

@router.post("/quotations/documents")
async def upload_quotation_document(
    file: UploadFile = File(...),
):
    """
    Upload endpoint for quotation documents.
    """
    import shutil
    from pathlib import Path

    # Create directory if not exists
    upload_dir = Path("media_uploads/quotations")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Unique file name to prevent collisions
    file_ext = Path(file.filename).suffix
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    dest_path = upload_dir / unique_filename

    # Save file
    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.error(f"Failed to save quotation document: {e}")
        raise HTTPException(status_code=500, detail="Could not save file")

    return {
        "file_name": file.filename,
        "file_url": f"/media/quotations/{unique_filename}"
    }


@router.post("/quotations", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def submit_quotation(
    request: SubmitQuotationRequest,
    background_tasks: BackgroundTasks,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> QuotationResponse:
    try:
        repo = SqlAlchemyQuotationRepository(uow.session)
        rfq_repo = SqlAlchemyRfqRepository(uow.session)
        use_case = SubmitQuotationUseCase(repo, rfq_repo)
        command = SubmitQuotationCommand(
            rfq_id=request.rfq_id,
            supplier_id=request.supplier_id,
            lines=[QuotationLineCommand(**l.dict()) for l in request.lines],
            documents=[QuotationDocumentCommand(**d.dict()) for d in request.documents] if request.documents else [],
            **request.dict(exclude={"lines", "rfq_id", "supplier_id", "documents"})
        )
        q_id = await use_case.handle(command)

        await uow.commit()

        q = await repo.get_by_id(q_id)
        if not q:
            raise HTTPException(status_code=404, detail="Quotation could not be retrieved after save")

        background_tasks.add_task(_notify_quotation_submitted, q.id)

        return _to_quotation_response(q)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit quotation: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/quotations", response_model=List[QuotationResponse])
async def list_quotations(
    rfq_id: Optional[str] = Query(None),
    supplier_id: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[QuotationResponse]:
    stmt = select(QuotationModel).options(
        selectinload(QuotationModel.lines),
        selectinload(QuotationModel.documents),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.contact),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.address),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.bank_info),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.documents),
    )
    if rfq_id:
        stmt = stmt.where(QuotationModel.rfq_id == rfq_id)
    if supplier_id:
        stmt = stmt.where(QuotationModel.supplier_id == supplier_id)

    res = await uow.session.execute(stmt)
    entities = res.scalars().all()
    return [_to_quotation_response(e) for e in entities]


@router.get("/quotations/{id}", response_model=QuotationResponse)
async def get_quotation(id: str, uow: UnitOfWork = Depends(get_uow)):
    stmt = select(QuotationModel).options(
        selectinload(QuotationModel.lines),
        selectinload(QuotationModel.documents),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.contact),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.address),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.bank_info),
        joinedload(QuotationModel.supplier).selectinload(SupplierModel.documents),
    ).where(QuotationModel.id == id)
    res = await uow.session.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Quotation not found")
    return _to_quotation_response(q)


@router.put("/quotations/{id}", response_model=QuotationResponse)
async def update_quotation(id: str, request: dict, uow: UnitOfWork = Depends(get_uow)):
    try:
        q_uuid = uuid.UUID(id)
        stmt = (
            select(QuotationModel)
            .options(
                selectinload(QuotationModel.lines),
                selectinload(QuotationModel.documents),
                joinedload(QuotationModel.supplier).selectinload(SupplierModel.contact),
                joinedload(QuotationModel.supplier).selectinload(SupplierModel.address),
                joinedload(QuotationModel.supplier).selectinload(SupplierModel.bank_info),
                joinedload(QuotationModel.supplier).selectinload(SupplierModel.documents),
            )
            .where(QuotationModel.id == q_uuid)
        )
        res = await uow.session.execute(stmt)
        q = res.scalar_one_or_none()
        if not q:
            raise HTTPException(status_code=404, detail="Quotation not found")

        # Update scalar fields
        scalar_fields = {
            "status", "discount", "tax", "freight_charges", "total_amount",
            "delivery_time", "expected_delivery_date", "payment_terms", "remarks"
        }
        for field in scalar_fields:
            if field in request:
                val = request[field]
                # Convert string dates to date objects
                if field == "expected_delivery_date" and isinstance(val, str):
                    try:
                        val = datetime.strptime(val, "%Y-%m-%d").date()
                    except (ValueError, TypeError):
                        val = None
                setattr(q, field, val)

        # Update nested lines
        if "lines" in request:
            q.lines.clear()
            for line in request["lines"]:
                q.lines.append(QuotationLineModel(
                    id=uuid.uuid4(),
                    quotation_id=q.id,
                    item_code=line.get("item_code") or line.get("itemCode"),
                    quantity=Decimal(str(line.get("quantity", 0))),
                    unit_price=Decimal(str(line.get("unit_price") or line.get("unitPrice") or 0))
                ))

        # Update nested documents
        if "documents" in request:
            q.documents.clear()
            for doc in request["documents"]:
                q.documents.append(QuotationDocumentModel(
                    id=uuid.uuid4(),
                    quotation_id=q.id,
                    document_type=doc.get("document_type") or doc.get("documentType"),
                    file_name=doc.get("file_name") or doc.get("fileName"),
                    file_url=doc.get("file_url") or doc.get("fileUrl")
                ))

        # Re-calculate total_amount
        line_total = sum((l.quantity * l.unit_price for l in q.lines), Decimal("0"))
        disc = Decimal(str(q.discount or 0))
        tx = Decimal(str(q.tax or 0))
        fr = Decimal(str(q.freight_charges or 0))

        # Standard calculation: (Base - Discount) + Tax% + Freight
        base_amount = line_total - disc
        calculated_tax = base_amount * (tx / Decimal("100")) if tx > 0 else Decimal("0")
        q.total_amount = base_amount + calculated_tax + fr

        await uow.commit()
        return _to_quotation_response(q)
    except Exception as e:
        logger.error(f"Update quotation failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/quotations/{id}/reject", response_model=QuotationResponse)
async def reject_quotation(
    id: str,
    request: dict,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> QuotationResponse:
    """Reject a supplier quotation and retain the operator's reason."""
    reason = str(request.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="A rejection reason is required")

    try:
        quotation_id = uuid.UUID(id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid quotation ID") from exc

    stmt = select(QuotationModel).options(
        selectinload(QuotationModel.lines),
        selectinload(QuotationModel.documents),
    ).where(QuotationModel.id == quotation_id)
    result = await uow.session.execute(stmt)
    quotation = result.scalar_one_or_none()
    if not quotation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Quotation not found")
    if quotation.status == "Selected":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The selected quotation cannot be rejected")
    if quotation.status == "Rejected":
        return _to_quotation_response(quotation)

    quotation.status = "Rejected"
    audit_note = f"Rejected by {_user.username}: {reason}"
    quotation.remarks = f"{quotation.remarks}\n{audit_note}" if quotation.remarks else audit_note
    await uow.commit()
    return _to_quotation_response(quotation)


def _to_quotation_response(q) -> QuotationResponse:
    lines = []
    for l in q.lines:
        if hasattr(l, "__dict__"):
            data = {k: v for k, v in l.__dict__.items() if not k.startswith('_')}
        else:
            data = {"item_code": l.item_code, "quantity": l.quantity, "unit_price": l.unit_price}
        lines.append(QuotationLineSchema(**data))

    documents = [QuotationDocumentSchema(
        document_type=document.document_type,
        file_name=document.file_name,
        file_url=document.file_url,
    ) for document in getattr(q, "documents", [])]

    supplier_info = None
    # Never trigger a relationship lazy-load while serializing an async response.
    # Endpoints that need supplier details explicitly eager-load this relationship.
    from sqlalchemy import inspect
    state = None
    try:
        state = inspect(q)
    except Exception:
        state = None

    supplier = None
    if state and hasattr(state, "unloaded"):
        supplier = getattr(q, "supplier", None) if "supplier" not in state.unloaded else None
    else:
        supplier = getattr(q, "supplier", None)

    if supplier:
        try:
            supplier_info = _response_from_entity(supplier)
        except Exception as e:
            logger.warning(f"Failed to map supplier info for quotation {getattr(q, 'id', 'unknown')}: {e}")

    return QuotationResponse(
        id=str(q.id),
        rfq_id=str(q.rfq_id),
        supplier_id=str(q.supplier_id),
        status=q.status,
        lines=lines,
        discount=getattr(q, "discount", Decimal("0")) or Decimal("0"),
        tax=getattr(q, "tax", Decimal("0")) or Decimal("0"),
        freight_charges=getattr(q, "freight_charges", Decimal("0")) or Decimal("0"),
        total_amount=getattr(q, "total_amount", Decimal("0")),
        delivery_time=getattr(q, "delivery_time", None),
        expected_delivery_date=getattr(q, "expected_delivery_date", None),
        payment_terms=getattr(q, "payment_terms", None),
        quotation_validity=getattr(q, "quotation_validity", None),
        remarks=getattr(q, "remarks", None),
        documents=documents,
        supplier_info=supplier_info,
        created_at=getattr(q, "created_at", None),
    )


# --- ASN ---

@router.post("/asns", response_model=AsnResponse, status_code=status.HTTP_201_CREATED)
async def create_asn(
    request: CreateAsnRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> AsnResponse:
    try:
        logger.info(f"Attempting to create ASN {request.asn_number} for PO {request.po_number}")
        repo = SqlAlchemyAsnRepository(uow.session)
        notif_repo = SqlAlchemyArrivalNotificationRepository(uow.session)
        use_case = CreateAsnUseCase(repo, notification_repository=notif_repo)

        supplier_id = _user.raw_claims.get("supplier_id") if "SUPPLIER" in _user.roles else None
        if supplier_id:
            supplier_id = str(supplier_id)

        # Older local supplier tokens did not preserve UUIDs correctly. Resolve
        # the supplier through the referenced PO so the ASN still has ownership.
        if not supplier_id and request.po_id:
            try:
                supplier_result = await uow.session.execute(
                    select(PurchaseOrderModel.supplier_id).where(
                        PurchaseOrderModel.id == uuid.UUID(request.po_id)
                    )
                )
                linked_supplier_id = supplier_result.scalar_one_or_none()
                supplier_id = str(linked_supplier_id) if linked_supplier_id else None
            except ValueError:
                pass

        # Manual date parsing for maximum flexibility
        expected_arrival = None
        if request.expected_arrival_at:
            try:
                # Parse and force to naive datetime to match DB TIMESTAMP WITHOUT TIME ZONE
                dt = datetime.fromisoformat(request.expected_arrival_at.replace("Z", "+00:00"))
                expected_arrival = dt.replace(tzinfo=None)
            except: pass

        ship_date = None
        if request.shipment_date:
            try:
                # Ensure we only have the date part
                ship_date = datetime.fromisoformat(request.shipment_date.split("T")[0]).date()
            except: pass

        command = CreateAsnCommand(
            asn_number=request.asn_number,
            lines=[AsnLineCommand(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
                material_name=l.material_name,
                uom=l.uom
            ) for l in request.lines],
            po_id=request.po_id,
            po_number=request.po_number,
            vehicle_number=request.vehicle_number,
            expected_arrival_at=expected_arrival,
            shipment_date=ship_date,
            driver_name=request.driver_name,
            driver_contact=request.driver_contact,
            transporter=request.transporter,
            number_of_packages=request.number_of_packages,
            package_type=request.package_type,
            shipping_method=request.shipping_method,
            status=request.status or "SUBMITTED",
            documents=[AsnDocumentCommand(
                document_type=document.document_type,
                file_name=document.file_name,
                file_url=document.file_url,
                uploaded_by=document.uploaded_by,
            ) for document in request.documents],
            supplier_id=supplier_id
        )
        asn_id = await use_case.handle(command)

        # Update Purchase Order status to SHIPPED if linked
        if request.po_id:
            try:
                po_stmt = (
                    select(PurchaseOrderModel)
                    .options(selectinload(PurchaseOrderModel.history))
                    .where(PurchaseOrderModel.id == uuid.UUID(request.po_id))
                )
                po_res = await uow.session.execute(po_stmt)
                po_obj = po_res.scalar_one_or_none()
                if po_obj:
                    po_obj.status = "SHIPPED"

                    # Record history
                    po_obj.history.append(POApprovalHistoryModel(
                        id=uuid.uuid4(),
                        status="SHIPPED",
                        actor_name=_user.username or "supplier",
                        comments=f"ASN {request.asn_number} submitted. Shipment is in transit."
                    ))

                    # Notify Procurement
                    uow.session.add(NotificationModel(
                        id=uuid.uuid4(),
                        user_role="PROCUREMENT",
                        title="Shipment Dispatched",
                        message=f"Supplier has dispatched goods for PO {po_obj.po_number}. ASN: {request.asn_number}",
                        link=f"/procurement/asns/{asn_id.value}"
                    ))
            except Exception as po_err:
                logger.warning(f"Failed to update PO status on ASN submission: {po_err}")

        # Fetch for response with all relations
        stmt = select(AsnModel).options(
            selectinload(AsnModel.lines),
            selectinload(AsnModel.documents)
        ).where(AsnModel.id == asn_id.value)
        res = await uow.session.execute(stmt)
        asn = res.scalar_one()

        return AsnResponse(
            id=str(asn.id),
            asn_number=asn.asn_number,
            status=asn.status,
            lines=[AsnLineSchema(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
                material_name=l.material_name,
                uom=l.uom
            ) for l in asn.lines],
            po_id=str(asn.po_id) if asn.po_id else None,
            po_number=asn.po_number,
            vehicle_number=asn.vehicle_number,
            expected_arrival_at=asn.expected_arrival_at,
            shipment_date=asn.shipment_date,
            driver_name=asn.driver_name,
            driver_contact=asn.driver_contact,
            transporter=asn.transporter,
            number_of_packages=asn.number_of_packages,
            package_type=asn.package_type,
            shipping_method=asn.shipping_method,
            documents=[AsnDocumentSchema(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
                uploaded_by=d.uploaded_by,
                uploaded_at=d.uploaded_at
            ) for d in asn.documents],
            created_at=asn.created_at,
        )
    except Exception as e:
        logger.error(f"ASN Submission failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/asns/next-number")
async def get_next_asn_number(uow: UnitOfWork = Depends(get_uow)):
    repo = SqlAlchemyAsnRepository(uow.session)
    use_case = GetNextAsnNumberUseCase(repo)
    num = await use_case.handle()
    return {"asnNumber": num}


@router.get("/asns", response_model=List[AsnResponse])
async def list_asns(
    supplier_id: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow)
):
    try:
        asn_supplier = aliased(SupplierModel)
        po_supplier = aliased(SupplierModel)
        resolved_supplier_id = func.coalesce(AsnModel.supplier_id, PurchaseOrderModel.supplier_id)
        stmt = (
            select(
                AsnModel,
                func.coalesce(asn_supplier.supplier_name, po_supplier.supplier_name),
                resolved_supplier_id,
            )
            .outerjoin(asn_supplier, AsnModel.supplier_id == asn_supplier.id)
            .outerjoin(PurchaseOrderModel, cast(PurchaseOrderModel.id, String) == AsnModel.po_id)
            .outerjoin(po_supplier, PurchaseOrderModel.supplier_id == po_supplier.id)
            .options(
                selectinload(AsnModel.lines),
                selectinload(AsnModel.documents)
            )
        )
        if supplier_id:
            stmt = stmt.where(resolved_supplier_id == supplier_id)

        res = await uow.session.execute(stmt)
        rows = res.all()

        responses = []
        for asn, supplier_name, resolved_id in rows:
            try:
                # Map lines carefully
                lines = []
                for l in asn.lines:
                    lines.append(AsnLineSchema(
                        item_code=l.item_code,
                        shipped_quantity=l.shipped_quantity,
                        material_name=getattr(l, "material_name", None),
                        uom=getattr(l, "uom", "PCS")
                    ))

                # Map documents carefully
                documents = []
                for d in asn.documents:
                    documents.append(AsnDocumentSchema(
                        document_type=d.document_type,
                        file_name=d.file_name,
                        file_url=d.file_url,
                        uploaded_by=d.uploaded_by,
                        uploaded_at=d.uploaded_at
                    ))

                responses.append(AsnResponse(
                    id=str(asn.id),
                    asn_number=asn.asn_number,
                    status=asn.status,
                    lines=lines,
                    po_id=str(asn.po_id) if asn.po_id else None,
                    po_number=asn.po_number,
                    supplier_id=str(resolved_id) if resolved_id else None,
                    supplier_name=supplier_name,
                    vehicle_number=asn.vehicle_number,
                    expected_arrival_at=asn.expected_arrival_at,
                    shipment_date=asn.shipment_date,
                    driver_name=asn.driver_name,
                    driver_contact=asn.driver_contact,
                    transporter=asn.transporter,
                    number_of_packages=asn.number_of_packages,
                    package_type=asn.package_type,
                    shipping_method=asn.shipping_method,
                    created_at=asn.created_at,
                    documents=documents
                ))
            except Exception as mapping_err:
                logger.error(f"Error mapping ASN {getattr(asn, 'id', 'unknown')}: {mapping_err}")
                continue

        return responses
    except Exception as e:
        logger.error(f"Failed to list ASNs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/asns/by-po-number/{po_number}", response_model=AsnResponse)
async def get_asn_by_po_number(po_number: str, uow: UnitOfWork = Depends(get_uow)):
    """Return the newest ASN linked to a PO for gate-entry autofill."""
    stmt = (
        select(AsnModel)
        .options(selectinload(AsnModel.lines), selectinload(AsnModel.documents))
        .where(func.upper(AsnModel.po_number) == po_number.strip().upper())
        .order_by(AsnModel.created_at.desc())
        .limit(1)
    )
    asn = (await uow.session.execute(stmt)).scalar_one_or_none()
    if asn is None:
        raise HTTPException(status_code=404, detail=f"ASN for purchase order {po_number} not found")

    supplier_name = None
    if asn.supplier_id:
        supplier = await uow.session.get(SupplierModel, asn.supplier_id)
        supplier_name = supplier.supplier_name if supplier else None

    return AsnResponse(
        id=str(asn.id),
        asn_number=asn.asn_number,
        status=asn.status,
        lines=[
            AsnLineSchema(
                item_code=line.item_code,
                shipped_quantity=line.shipped_quantity,
                material_name=getattr(line, "material_name", None),
                uom=getattr(line, "uom", "PCS"),
            )
            for line in asn.lines
        ],
        po_id=str(asn.po_id) if asn.po_id else None,
        po_number=asn.po_number,
        supplier_id=str(asn.supplier_id) if asn.supplier_id else None,
        supplier_name=supplier_name,
        vehicle_number=asn.vehicle_number,
        expected_arrival_at=asn.expected_arrival_at,
        shipment_date=asn.shipment_date,
        driver_name=asn.driver_name,
        driver_contact=asn.driver_contact,
        transporter=asn.transporter,
        number_of_packages=asn.number_of_packages,
        package_type=asn.package_type,
        shipping_method=asn.shipping_method,
        documents=[
            AsnDocumentSchema(
                document_type=document.document_type,
                file_name=document.file_name,
                file_url=document.file_url,
                uploaded_by=document.uploaded_by,
                uploaded_at=document.uploaded_at,
            )
            for document in asn.documents
        ],
        created_at=asn.created_at,
    )


@router.get("/asns/{id}", response_model=AsnResponse)
async def get_asn(id: str, uow: UnitOfWork = Depends(get_uow)):
    try:
        asn_supplier = aliased(SupplierModel)
        po_supplier = aliased(SupplierModel)
        resolved_supplier_id = func.coalesce(AsnModel.supplier_id, PurchaseOrderModel.supplier_id)
        stmt = (
            select(
                AsnModel,
                func.coalesce(asn_supplier.supplier_name, po_supplier.supplier_name),
                resolved_supplier_id,
            )
            .outerjoin(asn_supplier, AsnModel.supplier_id == asn_supplier.id)
            .outerjoin(PurchaseOrderModel, cast(PurchaseOrderModel.id, String) == AsnModel.po_id)
            .outerjoin(po_supplier, PurchaseOrderModel.supplier_id == po_supplier.id)
            .options(
                selectinload(AsnModel.lines),
                selectinload(AsnModel.documents)
            )
            .where(AsnModel.id == uuid.UUID(id))
        )
        res = await uow.session.execute(stmt)
        row = res.one_or_none()
        if not row:
            raise HTTPException(status_code=404, detail="ASN not found")

        asn, supplier_name, resolved_id = row

        return AsnResponse(
            id=str(asn.id),
            asn_number=asn.asn_number,
            status=asn.status,
            lines=[AsnLineSchema(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
                material_name=l.material_name,
                uom=l.uom
            ) for l in asn.lines],
            po_id=str(asn.po_id) if asn.po_id else None,
            po_number=asn.po_number,
            supplier_id=str(resolved_id) if resolved_id else None,
            supplier_name=supplier_name,
            vehicle_number=asn.vehicle_number,
            expected_arrival_at=asn.expected_arrival_at,
            shipment_date=asn.shipment_date,
            driver_name=asn.driver_name,
            driver_contact=asn.driver_contact,
            transporter=asn.transporter,
            number_of_packages=asn.number_of_packages,
            package_type=asn.package_type,
            shipping_method=asn.shipping_method,
            documents=[AsnDocumentSchema(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
                uploaded_by=d.uploaded_by,
                uploaded_at=d.uploaded_at
            ) for d in asn.documents],
            created_at=asn.created_at,
        )
    except Exception as e:
        logger.error(f"Get ASN failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/asns/{id}", response_model=AsnResponse)
async def resubmit_asn(
    id: str,
    request: CreateAsnRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
):
    try:
        asn_id = uuid.UUID(id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid ASN ID")

    asn_supplier = aliased(SupplierModel)
    po_supplier = aliased(SupplierModel)
    resolved_supplier_id = func.coalesce(AsnModel.supplier_id, PurchaseOrderModel.supplier_id)
    result = await uow.session.execute(
        select(
            AsnModel,
            func.coalesce(asn_supplier.supplier_name, po_supplier.supplier_name),
            resolved_supplier_id,
        )
        .outerjoin(asn_supplier, AsnModel.supplier_id == asn_supplier.id)
        .outerjoin(PurchaseOrderModel, cast(PurchaseOrderModel.id, String) == AsnModel.po_id)
        .outerjoin(po_supplier, PurchaseOrderModel.supplier_id == po_supplier.id)
        .options(selectinload(AsnModel.lines), selectinload(AsnModel.documents))
        .where(AsnModel.id == asn_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="ASN not found")
    asn, supplier_name, resolved_id = row

    supplier_id = _user.raw_claims.get("supplier_id") if "SUPPLIER" in _user.roles else None
    if supplier_id and resolved_id and str(resolved_id) != str(supplier_id):
        raise HTTPException(status_code=403, detail="You cannot edit another supplier's ASN")
    if asn.status.upper() in {"RECEIVED", "COMPLETED", "CANCELLED"}:
        raise HTTPException(status_code=409, detail=f"ASN cannot be edited while it is {asn.status}")

    try:
        expected_arrival = None
        if request.expected_arrival_at:
            expected_arrival = datetime.fromisoformat(
                request.expected_arrival_at.replace("Z", "+00:00")
            ).replace(tzinfo=None)

        shipment_date = asn.shipment_date
        if request.shipment_date:
            shipment_date = datetime.fromisoformat(request.shipment_date.split("T")[0]).date()

        asn.vehicle_number = request.vehicle_number
        asn.expected_arrival_at = expected_arrival
        asn.shipment_date = shipment_date
        asn.driver_name = request.driver_name
        asn.driver_contact = request.driver_contact
        asn.transporter = request.transporter
        asn.number_of_packages = request.number_of_packages
        asn.package_type = request.package_type
        asn.shipping_method = request.shipping_method
        asn.status = "DISPATCHED"

        # Create notification for procurement
        notification = NotificationModel(
            id=uuid.uuid4(),
            user_role="PROCUREMENT",
            title="ASN Corrected",
            message=f"Supplier {supplier_name or 'N/A'} has updated ASN {asn.asn_number} (PO: {asn.po_number}).",
            link=f"/procurement/asns/{asn.id}",
        )
        uow.session.add(notification)

        asn.lines.clear()
        asn.lines.extend([
            AsnLineModel(
                id=uuid.uuid4(),
                item_code=line.item_code,
                shipped_quantity=line.shipped_quantity,
                material_name=line.material_name,
                uom=line.uom,
            )
            for line in request.lines
        ])

        asn.documents.clear()
        asn.documents.extend([
            AsnDocumentModel(
                id=uuid.uuid4(),
                document_type=document.document_type,
                file_name=document.file_name,
                file_url=document.file_url,
                uploaded_by=document.uploaded_by,
                uploaded_at=document.uploaded_at or datetime.now(),
            )
            for document in request.documents
        ])

        notification_result = await uow.session.execute(
            select(ArrivalNotificationModel).where(ArrivalNotificationModel.asn_id == asn_id)
        )
        arrival_notification = notification_result.scalar_one_or_none()
        if arrival_notification:
            arrival_notification.vehicle_number = request.vehicle_number or ""
            if expected_arrival:
                arrival_notification.expected_arrival_time = expected_arrival
            arrival_notification.driver_phone = request.driver_contact
            arrival_notification.updated_at = datetime.now()

        await uow.commit()
        await uow.session.refresh(asn, attribute_names=["lines", "documents"])
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"ASN re-submission failed for {id}: {exc}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))

    return AsnResponse(
        id=str(asn.id),
        asn_number=asn.asn_number,
        status=asn.status,
        lines=[AsnLineSchema(
            item_code=line.item_code,
            shipped_quantity=line.shipped_quantity,
            material_name=line.material_name,
            uom=line.uom,
        ) for line in asn.lines],
        po_id=str(asn.po_id) if asn.po_id else None,
        po_number=asn.po_number,
        supplier_id=str(resolved_id) if resolved_id else None,
        supplier_name=supplier_name,
        vehicle_number=asn.vehicle_number,
        expected_arrival_at=asn.expected_arrival_at,
        shipment_date=asn.shipment_date,
        driver_name=asn.driver_name,
        driver_contact=asn.driver_contact,
        transporter=asn.transporter,
        number_of_packages=asn.number_of_packages,
        package_type=asn.package_type,
        shipping_method=asn.shipping_method,
        documents=[AsnDocumentSchema(
            document_type=document.document_type,
            file_name=document.file_name,
            file_url=document.file_url,
            uploaded_by=document.uploaded_by,
            uploaded_at=document.uploaded_at,
        ) for document in asn.documents],
        created_at=asn.created_at,
    )


@router.get("/arrival-notifications", response_model=List[ArrivalNotificationResponse])
async def list_arrival_notifications(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    repo = SqlAlchemyArrivalNotificationRepository(uow.session)
    notifications = await repo.list_all()
    po_ids = []
    po_numbers = {str(notification.po_number) for notification in notifications if notification.po_number}
    for notification in notifications:
        if notification.po_id:
            try:
                po_ids.append(uuid.UUID(str(notification.po_id)))
            except (ValueError, TypeError):
                pass
    supplier_by_po_id = {}
    supplier_by_po_number = {}
    if po_ids or po_numbers:
        supplier_result = await uow.session.execute(
            select(PurchaseOrderModel.id, PurchaseOrderModel.po_number, PurchaseOrderModel.supplier_name).where(
                or_(PurchaseOrderModel.id.in_(po_ids), PurchaseOrderModel.po_number.in_(po_numbers))
            )
        )
        for po_id, po_number, supplier_name in supplier_result.all():
            if supplier_name:
                supplier_by_po_id[str(po_id)] = supplier_name
                supplier_by_po_number[str(po_number)] = supplier_name
    return [
        ArrivalNotificationResponse(
            id=n.id,
            asn_id=n.asn_id,
            asn_number=n.asn_number,
            po_id=n.po_id,
            po_number=n.po_number,
            warehouse_id=n.warehouse_id,
            supplier_name=supplier_by_po_id.get(
                str(n.po_id), supplier_by_po_number.get(str(n.po_number), n.supplier_name)
            ),
            vehicle_number=n.vehicle_number,
            expected_arrival_time=n.expected_arrival_time,
            driver_phone=n.driver_phone,
            message=n.message,
            status=n.status if isinstance(n.status, str) else n.status.value,
            created_at=n.created_at,
        )
        for n in notifications
    ]


# --- Notifications ---

@router.get("/notifications")
async def list_notifications(
    role: str = Query(...),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    normalized_role = role.strip().upper()
    if normalized_role not in _user.roles and "ADMIN" not in _user.roles:
         raise HTTPException(status_code=403, detail="Not authorized to view notifications for this role")

    stmt = select(NotificationModel).where(NotificationModel.user_role == normalized_role).order_by(NotificationModel.created_at.desc())
    res = await uow.session.execute(stmt)
    return res.scalars().all()


@router.post("/notifications/{id}/read")
async def mark_notification_read(
    id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    stmt = select(NotificationModel).where(NotificationModel.id == uuid.UUID(id))
    res = await uow.session.execute(stmt)
    n = res.scalar_one_or_none()
    if n:
        n.is_read = True
    await uow.commit()
    return {"status": "success"}


@router.post("/notifications/read-all")
async def mark_all_notifications_read(
    role: str = Query(...),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    normalized_role = role.strip().upper()
    if normalized_role not in _user.roles and "ADMIN" not in _user.roles:
         raise HTTPException(status_code=403, detail="Not authorized to update notifications for this role")

    result = await uow.session.execute(
        update(NotificationModel)
        .where(NotificationModel.user_role == normalized_role, NotificationModel.is_read.is_(False))
        .values(is_read=True)
    )
    await uow.commit()
    return {"status": "success", "updated": result.rowcount or 0}


@router.post("/arrival-notifications/{notification_id}/read")
async def mark_arrival_notification_read(
    notification_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    result = await uow.session.execute(
        update(ArrivalNotificationModel)
        .where(ArrivalNotificationModel.id == notification_id)
        .values(status="ACKNOWLEDGED", updated_at=datetime.now())
    )
    await uow.commit()
    if not result.rowcount:
        raise HTTPException(status_code=404, detail="Arrival notification not found")
    return {"status": "success"}


@router.post("/arrival-notifications/read-all")
async def mark_all_arrival_notifications_read(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user)
):
    result = await uow.session.execute(
        update(ArrivalNotificationModel)
        .where(ArrivalNotificationModel.status != "ACKNOWLEDGED")
        .values(status="ACKNOWLEDGED", updated_at=datetime.now())
    )
    await uow.commit()
    return {"status": "success", "updated": result.rowcount or 0}


# --- Supplier Auth Endpoints ---

@router.post("/auth/supplier-login", response_model=SupplierLoginResponse)
async def supplier_login(
    request: SupplierLoginRequest,
    uow: UnitOfWork = Depends(get_uow),
) -> SupplierLoginResponse:
    import hashlib
    password_hash = hashlib.sha256(request.password.encode()).hexdigest()
    stmt = select(SupplierUserModel).where(
        SupplierUserModel.username == request.username,
        SupplierUserModel.password_hash == password_hash
    )
    result = await uow.session.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid supplier username or password"
        )
    return SupplierLoginResponse(
        token=f"supplier-mock-token-{user.id}-{user.supplier_id}",
        supplier_id=str(user.supplier_id),
        must_change_password=user.must_change_password,
        username=user.username,
    )


@router.post("/auth/change-password")
async def change_password(
    request: ChangePasswordRequest,
    uow: UnitOfWork = Depends(get_uow),
) -> dict:
    import hashlib
    old_hash = hashlib.sha256(request.old_password.encode()).hexdigest()
    stmt = select(SupplierUserModel).where(
        SupplierUserModel.username == request.username,
        SupplierUserModel.password_hash == old_hash
    )
    result = await uow.session.execute(stmt)
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid old password"
        )
    new_hash = hashlib.sha256(request.new_password.encode()).hexdigest()
    user.password_hash = new_hash
    user.must_change_password = False
    await uow.session.flush()
    await uow.commit()
    return {"success": True}


@router.post("/auth/dev-login")
async def dev_login(
    request: DevLoginRequest,
) -> dict:
    from app.config.settings import get_settings
    settings = get_settings()
    # Validate against configured settings (from .env)
    if request.username == settings.admin_username and request.password == settings.admin_password:
        return {
            "token": "mock-jwt-admin-token",
            "username": settings.admin_username,
            "roles": ["ADMIN"]
        }
    elif request.username == settings.procurement_username and request.password == settings.procurement_password:
        return {
            "token": "mock-jwt-procurement-token",
            "username": settings.procurement_username,
            "roles": ["PROCUREMENT"]
        }
    elif request.username == settings.finance_username and request.password == settings.finance_password:
        return {
            "token": "mock-jwt-finance-token",
            "username": settings.finance_username,
            "roles": ["FINANCE"]
        }
    elif request.username == settings.warehouse_username and request.password == settings.warehouse_password:
        return {
            "token": "mock-jwt-warehouse-token",
            "username": settings.warehouse_username,
            "roles": ["WAREHOUSE"]
        }
    elif request.username == settings.assembly_manager_username and request.password == settings.assembly_manager_password:
        return {
            "token": "mock-jwt-assembly-manager-token",
            "username": settings.assembly_manager_username,
            "roles": ["ASSEMBLY_MANAGER"]
        }
    elif request.username == settings.gate_security_username and request.password == settings.gate_security_password:
        return {
            "token": "mock-jwt-gate-entry-token",
            "username": settings.gate_security_username,
            "roles": ["GATE_SECURITY"]
        }
    elif request.username == settings.supplier_username and request.password == settings.supplier_password:
        return {
            "token": "mock-jwt-supplier-token",
            "username": settings.supplier_username,
            "roles": ["SUPPLIER"]
        }
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )


@router.get("/global-search", response_model=GlobalSearchResponse)
async def global_search(
    q: str = Query(..., min_length=1),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
):
    """
    Search across Suppliers, POs, ASNs, Material Requests and RFQs.
    Provides real-time results for the navbar search.
    """
    try:
        search_term = f"%{q}%"
        results = []

        # 1. Search Suppliers
        supplier_stmt = select(SupplierModel).where(
            or_(
                SupplierModel.supplier_name.ilike(search_term),
                SupplierModel.supplier_code.ilike(search_term),
                SupplierModel.registered_company_name.ilike(search_term)
            )
        ).limit(5)
        supplier_res = await uow.session.execute(supplier_stmt)
        for s in supplier_res.scalars().all():
            results.append({
                "id": str(s.id),
                "type": "SUPPLIER",
                "title": s.supplier_name,
                "subtitle": f"Vendor Code: {s.supplier_code or 'N/A'}",
                "link": f"/master-data?search={s.supplier_name}"
            })

        # 2. Search Purchase Orders
        po_stmt = select(PurchaseOrderModel).where(
            or_(
                PurchaseOrderModel.po_number.ilike(search_term),
                PurchaseOrderModel.supplier_name.ilike(search_term)
            )
        ).limit(5)
        po_res = await uow.session.execute(po_stmt)
        for po in po_res.scalars().all():
            results.append({
                "id": str(po.id),
                "type": "PO",
                "title": f"PO: {po.po_number}",
                "subtitle": f"Vendor: {po.supplier_name} · Status: {po.status}",
                "link": f"/purchase-order?poId={po.id}"
            })

        # 3. Search ASNs
        asn_stmt = select(AsnModel).where(
            or_(
                AsnModel.asn_number.ilike(search_term),
                AsnModel.po_number.ilike(search_term),
                AsnModel.vehicle_number.ilike(search_term),
                AsnModel.driver_name.ilike(search_term)
            )
        ).limit(5)
        asn_res = await uow.session.execute(asn_stmt)
        for asn in asn_res.scalars().all():
            results.append({
                "id": str(asn.id),
                "type": "ASN",
                "title": f"ASN: {asn.asn_number}",
                "subtitle": f"Vehicle: {asn.vehicle_number or 'N/A'} · Status: {asn.status}",
                "link": f"/procurement/asns/{asn.id}"
            })

        # 4. Search Material Requests
        mr_stmt = select(MaterialRequestModel).where(
            or_(
                MaterialRequestModel.request_number.ilike(search_term),
                MaterialRequestModel.requested_by.ilike(search_term),
                MaterialRequestModel.department.ilike(search_term)
            )
        ).limit(5)
        mr_res = await uow.session.execute(mr_stmt)
        for mr in mr_res.scalars().all():
            results.append({
                "id": str(mr.id),
                "type": "MATERIAL_REQUEST",
                "title": f"Req: {mr.request_number}",
                "subtitle": f"By: {mr.requested_by} · Dept: {mr.department}",
                "link": f"/procurement/material-requests"
            })

        # 5. Search RFQs
        rfq_stmt = select(RfqModel).where(
            or_(
                RfqModel.rfq_number.ilike(search_term),
                RfqModel.procurement_officer.ilike(search_term)
            )
        ).limit(5)
        rfq_res = await uow.session.execute(rfq_stmt)
        for rfq in rfq_res.scalars().all():
            results.append({
                "id": str(rfq.id),
                "type": "RFQ",
                "title": f"RFQ: {rfq.rfq_number}",
                "subtitle": f"Status: {rfq.status} · Officer: {rfq.procurement_officer}",
                "link": f"/procurement/rfqs"
            })

        # 6. Search Gate Entries (from memory if available)
        # Note: Accessing gate router's memory repo directly is complex due to structure.
        # Most gate entries will have associated POs or ASNs which are already searched.

        return {"results": results}
    except Exception as e:
        logger.error(f"Global search failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


async def check_upcoming_arrivals():
    """Background task to notify warehouse manager of arrivals in 5 days."""
    from datetime import timedelta
    from app.database.session import session_scope

    try:
        async with session_scope() as session:
            # Target date is exactly 5 days from today
            target_date = (datetime.now() + timedelta(days=5)).date()

            # Find ASNs arriving on that day that are in transit
            stmt = select(AsnModel).where(
                cast(AsnModel.expected_arrival_at, Date) == target_date,
                AsnModel.status == "DISPATCHED"
            )
            res = await session.execute(stmt)
            asns = res.scalars().all()

            for asn in asns:
                # Check if we already sent this specific 5-day reminder to avoid spam
                # Link is used as a unique identifier for the specific ASN reminder
                unique_link = f"/notifications?asnId={asn.id}&alert=5day"

                check_stmt = select(NotificationModel).where(
                    NotificationModel.link == unique_link
                )
                check_res = await session.execute(check_stmt)
                if check_res.scalar_one_or_none():
                    continue

                msg = f"Shipment PO {asn.po_number} / ASN {asn.asn_number} is arriving in 5 days ({target_date}). Please prepare the warehouse for receiving."

                new_notif = NotificationModel(
                    id=uuid.uuid4(),
                    user_role="WAREHOUSE",
                    title="Upcoming Arrival (5 Days)",
                    message=msg,
                    link=unique_link,
                    is_read=False,
                    created_at=datetime.now()
                )
                session.add(new_notif)
                logger.info(f"Generated 5-day arrival reminder for ASN {asn.asn_number}")

            # Note: session.commit() is handled by session_scope()
    except Exception as e:
        logger.error(f"Background arrival check failed: {e}")
