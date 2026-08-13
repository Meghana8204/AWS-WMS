"""
Inbound API adapter for procurement supplier module.
Translates HTTP requests into CreateSupplierCommand, invokes use case, and maps result back to HTTP response.
Protected by standard JWT authentication (get_current_user).
"""
from __future__ import annotations

import os
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload

from app.config.settings import get_settings
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
    CreatePurchaseOrderCommand,
    PurchaseOrderLineCommand,
    CreateAsnCommand,
    AsnLineCommand,
)
from app.modules.procurement.application.use_cases import (
    CreateSupplierUseCase,
    GetSupplierUseCase,
    ListSuppliersUseCase,
    CreateRfqUseCase,
    SendRfqUseCase,
    SubmitQuotationUseCase,
    CreatePurchaseOrderUseCase,
    CreateAsnUseCase,
)
from app.modules.procurement.domain.value_objects import (
    SupplierId,
    RfqId,
    QuotationId,
    PurchaseOrderId,
    AsnId,
)
from app.modules.procurement.infrastructure.api.schemas import (
    AddressSchema,
    BankInfoSchema,
    ContactSchema,
    CreateSupplierRequest,
    DocumentSchema,
    DocumentUploadResponse,
    SupplierResponse,
    CreateRfqRequest,
    RfqResponse,
    RfqItemSchema,
    SubmitQuotationRequest,
    QuotationResponse,
    QuotationLineSchema,
    CreatePurchaseOrderRequest,
    PurchaseOrderResponse,
    PurchaseOrderLineSchema,
    CreateAsnRequest,
    AsnResponse,
    AsnLineSchema,
    SupplierLoginRequest,
    SupplierLoginResponse,
    ChangePasswordRequest,
    UpdateQuotationRequest,
    UpdatePurchaseOrderRequest,
    DevLoginRequest,
    PurchaseOrderApprovalLogSchema,
    NotificationDispatchResponse,
)
from app.modules.procurement.infrastructure.persistence.models import (
    SupplierModel,
    SupplierAddressModel,
    SupplierContactModel,
    RfqModel,
    QuotationModel,
    PurchaseOrderModel,
    AsnModel,
    SupplierUserModel,
)
from app.modules.procurement.infrastructure.persistence.repository_impl import (
    SqlAlchemySupplierRepository,
    SqlAlchemyRfqRepository,
    SqlAlchemyQuotationRepository,
    SqlAlchemyPurchaseOrderRepository,
    SqlAlchemyAsnRepository,
)
from app.security.dependencies import CurrentUser, get_current_user

router = APIRouter(prefix="/api/v1/procurement", tags=["procurement"])


@router.get("/health", tags=["ops"])
async def procurement_health() -> dict:
    return {"status": "UP", "module": "procurement"}


ALLOWED_DOC_TYPES = {
    "GST_CERTIFICATE",
    "CANCELLED_CHEQUE",
    "MSME_CERTIFICATE",
    "ISO_CERTIFICATE",
    "VENDOR_CODE_OF_CONDUCT",
}

_STAGED_UPLOADS: dict[str, dict] = {}


def _response_from_entity(entity: SupplierModel) -> SupplierResponse:
    return SupplierResponse(
        supplier_id=str(entity.id),
        supplier_name=entity.supplier_name,
        registered_company_name=entity.registered_company_name,
        vendor_type=entity.vendor_type,
        category=entity.category,
        industry=entity.industry,
        gstin=entity.gstin,
        supplier_code=entity.supplier_code,
        main_material=entity.main_material,
        rating=float(entity.rating),
        performance_score=float(entity.performance_score),
        city=entity.address.city if entity.address else None,
        address=AddressSchema(
            registered_address=entity.address.registered_address,
            city=entity.address.city,
            country=entity.address.country,
            state=entity.address.state,
            pincode=entity.address.pincode,
        ) if entity.address else None,
        contact=ContactSchema(
            primary_contact_name=entity.contact.primary_contact_name,
            email=entity.contact.email,
            designation=entity.contact.designation,
            phone=entity.contact.phone,
            website=entity.contact.website,
        ) if entity.contact else None,
        bank_info=BankInfoSchema(
            bank_name=entity.bank_info.bank_name,
            account_number=entity.bank_info.account_number,
            account_holder_name=entity.bank_info.account_holder_name,
            ifsc=entity.bank_info.ifsc,
            branch=entity.bank_info.branch,
            swift_bic=entity.bank_info.swift_bic,
            tds_section=entity.bank_info.tds_section,
        ) if entity.bank_info else None,
        documents=[
            DocumentSchema(
                upload_id=None,
                document_type=document.document_type,
                file_name=document.file_name,
                file_type=document.file_type,
                file_size=document.file_size,
            )
            for document in entity.documents
        ],
        remarks=entity.remarks,
        status=entity.status,
    )


async def _supplier_entity(uow: UnitOfWork, supplier_id: str) -> SupplierModel:
    try:
        supplier_uuid = uuid.UUID(supplier_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Supplier not found: {supplier_id}") from exc

    result = await uow.session.execute(
        select(SupplierModel)
        .options(
            selectinload(SupplierModel.address),
            selectinload(SupplierModel.contact),
            selectinload(SupplierModel.bank_info),
            selectinload(SupplierModel.documents),
        )
        .where(SupplierModel.id == supplier_uuid)
    )
    entity = result.scalar_one_or_none()
    if entity is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Supplier not found: {supplier_id}")
    return entity


async def _validate_uploaded_file(file: UploadFile, document_type: str) -> tuple[bytes, int, str, str]:
    doc_type = document_type.strip() if document_type else ""
    if doc_type not in ALLOWED_DOC_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid document type. Allowed types: {', '.join(sorted(ALLOWED_DOC_TYPES))}",
        )

    raw_filename = file.filename or ""
    safe_filename = os.path.basename(raw_filename)
    if not safe_filename:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File name cannot be empty")

    allowed_exts = (".pdf", ".jpg", ".jpeg")
    file_ext = os.path.splitext(safe_filename)[1].lower()
    if file_ext not in allowed_exts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid document format. Only PDF and JPG files are allowed.",
        )

    contents = await file.read()
    file_size = len(contents)
    max_size_bytes = 10 * 1024 * 1024
    if file_size > max_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Document size exceeds maximum limit of 10 MB.",
        )

    return contents, file_size, file_ext, safe_filename


@router.post("/suppliers/documents", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_supplier_document(
    document_type: str = Form(...),
    file: UploadFile = File(...),
    _user: CurrentUser = Depends(get_current_user),
) -> DocumentUploadResponse:
    doc_type = document_type.strip() if document_type else ""
    contents, file_size, _file_ext, safe_filename = await _validate_uploaded_file(file, doc_type)

    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join("uploads", "suppliers")
    os.makedirs(upload_dir, exist_ok=True)
    unique_filename = f"{upload_id}_{safe_filename}"
    storage_path = os.path.join(upload_dir, unique_filename)

    with open(storage_path, "wb") as f:
        f.write(contents)

    _STAGED_UPLOADS[upload_id] = {
        "upload_id": upload_id,
        "user_id": _user.subject,
        "document_type": doc_type,
        "file_name": safe_filename,
        "file_type": file.content_type or "application/octet-stream",
        "file_size": file_size,
        "storage_path": storage_path,
        "consumed": False,
    }

    return DocumentUploadResponse(
        upload_id=upload_id,
        document_type=doc_type,
        file_name=safe_filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
    )


@router.post("/suppliers/{supplier_id}/documents", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document_for_existing_supplier(
    supplier_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> DocumentUploadResponse:
    repo = SqlAlchemySupplierRepository(uow.session)
    supplier = await repo.find_by_id(SupplierId.of(supplier_id))
    if supplier is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Supplier not found: {supplier_id}")

    doc_type = document_type.strip() if document_type else ""
    contents, file_size, _file_ext, safe_filename = await _validate_uploaded_file(file, doc_type)

    upload_id = str(uuid.uuid4())
    upload_dir = os.path.join("uploads", "suppliers")
    os.makedirs(upload_dir, exist_ok=True)
    unique_filename = f"{upload_id}_{safe_filename}"
    storage_path = os.path.join(upload_dir, unique_filename)

    with open(storage_path, "wb") as f:
        f.write(contents)

    from app.modules.procurement.infrastructure.persistence.models import SupplierDocumentModel

    supplier_uuid = supplier.id.value if hasattr(supplier.id, "value") else uuid.UUID(str(supplier.id))
    doc_model = SupplierDocumentModel(
        supplier_id=supplier_uuid,
        document_type=doc_type,
        file_name=safe_filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
        storage_path=storage_path,
    )
    uow.session.add(doc_model)
    await uow.session.flush()

    return DocumentUploadResponse(
        upload_id=upload_id,
        document_type=doc_type,
        file_name=safe_filename,
        file_type=file.content_type or "application/octet-stream",
        file_size=file_size,
    )


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
@router.post("/suppliers/", response_model=SupplierResponse, include_in_schema=False)
async def create_supplier(
    request: CreateSupplierRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    repo = SqlAlchemySupplierRepository(uow.session)
    use_case = CreateSupplierUseCase(repo)

    address_cmd = None
    if request.address:
        address_cmd = AddressCommand(
            registered_address=request.address.registered_address,
            city=request.address.city,
            country=request.address.country,
            state=request.address.state,
            pincode=request.address.pincode,
        )

    contact_cmd = None
    if request.contact:
        contact_cmd = ContactCommand(
            primary_contact_name=request.contact.primary_contact_name,
            email=request.contact.email,
            designation=request.contact.designation,
            phone=request.contact.phone,
            website=request.contact.website,
        )

    bank_info_cmd = None
    if request.bank_info:
        bank_info_cmd = BankInfoCommand(
            bank_name=request.bank_info.bank_name,
            account_number=request.bank_info.account_number,
            account_holder_name=request.bank_info.account_holder_name,
            ifsc=request.bank_info.ifsc,
            branch=request.bank_info.branch,
            swift_bic=request.bank_info.swift_bic,
            tds_section=request.bank_info.tds_section,
        )

    doc_cmds = []
    response_docs = []
    if request.documents:
        for doc in request.documents:
            upload_id = doc.upload_id
            if not upload_id or upload_id not in _STAGED_UPLOADS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid or missing upload ID: {upload_id}",
                )

            staged = _STAGED_UPLOADS[upload_id]
            if staged["user_id"] != _user.subject:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Staged document does not belong to current user",
                )
            if staged["consumed"]:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Staged document has already been consumed",
                )

            staged["consumed"] = True
            storage_path = staged["storage_path"]

            doc_cmds.append(
                DocumentCommand(
                    document_type=doc.document_type,
                    file_name=doc.file_name,
                    file_type=doc.file_type,
                    file_size=doc.file_size,
                    storage_path=storage_path,
                    upload_id=upload_id,
                )
            )
            response_docs.append(
                DocumentSchema(
                    upload_id=upload_id,
                    document_type=doc.document_type,
                    file_name=doc.file_name,
                    file_type=doc.file_type,
                    file_size=doc.file_size,
                )
            )

    command = CreateSupplierCommand(
        supplier_name=request.supplier_name,
        registered_company_name=request.registered_company_name,
        vendor_type=request.vendor_type,
        category=request.category,
        industry=request.industry,
        gstin=request.gstin,
        address=address_cmd,
        contact=contact_cmd,
        bank_info=bank_info_cmd,
        documents=doc_cmds,
        remarks=request.remarks,
    )
    supplier_id = await use_case.handle(command)

    return SupplierResponse(
        supplier_id=str(supplier_id),
        supplier_name=request.supplier_name,
        registered_company_name=request.registered_company_name,
        vendor_type=request.vendor_type,
        category=request.category,
        industry=request.industry,
        gstin=request.gstin,
        address=request.address,
        contact=request.contact,
        bank_info=request.bank_info,
        documents=response_docs,
        remarks=request.remarks,
        status="Active",
    )


@router.get("/suppliers", response_model=List[SupplierResponse])
@router.get("/suppliers/", response_model=List[SupplierResponse], include_in_schema=False)
async def list_suppliers(
    search: Optional[str] = Query(None, description="Search by name or code"),
    category: Optional[str] = Query(None),
    material: Optional[str] = Query(None),
    city: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[SupplierResponse]:
    print(f"Listing suppliers (search={search}, cat={category})...")

    stmt = select(SupplierModel).options(
        selectinload(SupplierModel.address),
        selectinload(SupplierModel.contact),
        selectinload(SupplierModel.bank_info),
        selectinload(SupplierModel.documents),
    )

    if search:
        stmt = stmt.where(or_(
            SupplierModel.supplier_name.ilike(f"%{search}%"),
            SupplierModel.supplier_code.ilike(f"%{search}%")
        ))
    if category:
        stmt = stmt.where(SupplierModel.category == category)
    if material:
        stmt = stmt.where(SupplierModel.main_material.ilike(f"%{material}%"))
    if city:
        stmt = stmt.join(SupplierModel.address).where(SupplierAddressModel.city.ilike(f"%{city}%"))

    result = await uow.session.execute(stmt.order_by(SupplierModel.supplier_name))
    entities = result.scalars().all()

    return [_response_from_entity(e) for e in entities]


@router.get("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def get_supplier(
    supplier_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    repo = SqlAlchemySupplierRepository(uow.session)
    use_case = GetSupplierUseCase(repo)
    supplier = await use_case.handle(SupplierId.of(supplier_id))

    address_schema = None
    if supplier.address:
        address_schema = AddressSchema(
            registered_address=supplier.address.registered_address,
            city=supplier.address.city,
            country=supplier.address.country,
            state=supplier.address.state,
            pincode=supplier.address.pincode,
        )

    contact_schema = None
    if supplier.contact:
        contact_schema = ContactSchema(
            primary_contact_name=supplier.contact.primary_contact_name,
            email=supplier.contact.email,
            designation=supplier.contact.designation,
            phone=supplier.contact.phone,
            website=supplier.contact.website,
        )

    bank_info_schema = None
    if supplier.bank_info:
        bank_info_schema = BankInfoSchema(
            bank_name=supplier.bank_info.bank_name,
            account_number=supplier.bank_info.account_number,
            account_holder_name=supplier.bank_info.account_holder_name,
            ifsc=supplier.bank_info.ifsc,
            branch=supplier.bank_info.branch,
            swift_bic=supplier.bank_info.swift_bic,
            tds_section=supplier.bank_info.tds_section,
        )

    doc_schemas = [
        DocumentSchema(
            upload_id=doc.upload_id,
            document_type=doc.document_type,
            file_name=doc.file_name,
            file_type=doc.file_type,
            file_size=doc.file_size,
        )
        for doc in supplier.documents
    ]

    return SupplierResponse(
        supplier_id=str(supplier.id),
        supplier_name=supplier.supplier_name,
        registered_company_name=supplier.registered_company_name,
        vendor_type=supplier.vendor_type,
        category=supplier.category,
        industry=supplier.industry,
        gstin=supplier.gstin,
        address=address_schema,
        contact=contact_schema,
        bank_info=bank_info_schema,
        documents=doc_schemas,
        remarks=supplier.remarks,
        status=supplier.status,
    )


@router.put("/suppliers/{supplier_id}", response_model=SupplierResponse)
async def update_supplier(
    supplier_id: str,
    request: CreateSupplierRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    """Replace the editable supplier master fields and return the saved record."""
    entity = await _supplier_entity(uow, supplier_id)
    entity.supplier_name = request.supplier_name
    entity.registered_company_name = request.registered_company_name
    entity.vendor_type = request.vendor_type
    entity.category = request.category
    entity.industry = request.industry
    entity.gstin = request.gstin
    entity.remarks = request.remarks

    if request.address and entity.address:
        entity.address.registered_address = request.address.registered_address
        entity.address.city = request.address.city
        entity.address.country = request.address.country
        entity.address.state = request.address.state
        entity.address.pincode = request.address.pincode
    if request.contact and entity.contact:
        entity.contact.primary_contact_name = request.contact.primary_contact_name
        entity.contact.email = request.contact.email
        entity.contact.designation = request.contact.designation
        entity.contact.phone = request.contact.phone
        entity.contact.website = request.contact.website
    if request.bank_info and entity.bank_info:
        entity.bank_info.bank_name = request.bank_info.bank_name
        entity.bank_info.account_number = request.bank_info.account_number
        entity.bank_info.account_holder_name = request.bank_info.account_holder_name
        entity.bank_info.ifsc = request.bank_info.ifsc
        entity.bank_info.branch = request.bank_info.branch
        entity.bank_info.swift_bic = request.bank_info.swift_bic
        entity.bank_info.tds_section = request.bank_info.tds_section

    await uow.session.flush()
    return _response_from_entity(entity)


@router.post("/suppliers/{supplier_id}/block", response_model=SupplierResponse)
async def block_supplier(
    supplier_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    """Immediately block a supplier from operational use."""
    entity = await _supplier_entity(uow, supplier_id)
    entity.status = "Blocked"
    await uow.session.flush()
    return _response_from_entity(entity)


@router.post("/suppliers/{supplier_id}/unblock", response_model=SupplierResponse)
async def unblock_supplier(
    supplier_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> SupplierResponse:
    """Restore a blocked supplier for operational use."""
    entity = await _supplier_entity(uow, supplier_id)
    entity.status = "Active"
    await uow.session.flush()
    return _response_from_entity(entity)


# --- RFQ ---

@router.post("/rfqs", response_model=RfqResponse, status_code=status.HTTP_201_CREATED)
async def create_rfq(
    request: CreateRfqRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> RfqResponse:
    repo = SqlAlchemyRfqRepository(uow.session)
    use_case = CreateRfqUseCase(repo)
    command = CreateRfqCommand(
        rfq_date=request.rfq_date,
        warehouse=request.warehouse,
        procurement_officer=request.procurement_officer,
        supplier_ids=request.supplier_ids,
        items=[
            RfqItemCommand(
                material_code=item.material_code,
                material_name=item.material_name,
                category=item.category,
                quantity=item.quantity,
                uom=item.uom,
                required_delivery_date=item.required_delivery_date,
                warehouse=item.warehouse,
                special_requirements=item.special_requirements,
            )
            for item in request.items
        ],
        material_request_number=request.material_request_number,
        required_delivery_date=request.required_delivery_date,
        valid_until=request.valid_until,
        remarks=request.remarks,
    )
    rfq_id = await use_case.handle(command)
    rfq = await repo.get_by_id(RfqId.of(rfq_id))
    return _to_rfq_response(rfq)


def _to_rfq_response(rfq: RFQ) -> RfqResponse:
    return RfqResponse(
        id=str(rfq.id),
        rfq_number=rfq.rfq_number,
        rfq_date=rfq.rfq_date,
        warehouse=rfq.warehouse,
        procurement_officer=rfq.procurement_officer,
        status=rfq.status,
        supplier_ids=[str(sid) for sid in rfq.supplier_ids],
        items=[
            RfqItemSchema(
                material_code=item.material_code,
                material_name=item.material_name,
                category=item.category,
                quantity=item.quantity,
                uom=item.uom,
                required_delivery_date=item.required_delivery_date,
                warehouse=item.warehouse,
                special_requirements=item.special_requirements,
            )
            for item in rfq.items
        ],
        material_request_number=rfq.material_request_number,
        required_delivery_date=rfq.required_delivery_date,
        valid_until=rfq.valid_until,
        remarks=rfq.remarks,
        created_at=rfq.created_at,
        selected_supplier_id=str(rfq.selected_supplier_id) if rfq.selected_supplier_id else None,
        selection_date=rfq.selection_date,
        selected_by=rfq.selected_by,
        selection_reason=rfq.selection_reason,
        selection_comments=rfq.selection_comments,
    )


@router.get("/rfqs", response_model=List[RfqResponse])
async def list_rfqs(
    supplier_id: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[RfqResponse]:
    repo = SqlAlchemyRfqRepository(uow.session)
    rfqs = await repo.list_all()
    if supplier_id:
        rfqs = [r for r in rfqs if any(str(sid) == supplier_id for sid in r.supplier_ids)]
    return [_to_rfq_response(r) for r in rfqs]


@router.post("/rfqs/{rfq_id}/send", response_model=RfqResponse)
async def send_rfq(
    rfq_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> RfqResponse:
    import random
    import string
    import hashlib
    import os
    from app.logging.logger import get_logger

    logger = get_logger(__name__)
    repo = SqlAlchemyRfqRepository(uow.session)
    use_case = SendRfqUseCase(repo)
    await use_case.handle(RfqId.of(rfq_id))
    rfq = await repo.get_by_id(RfqId.of(rfq_id))

    # Iterate over suppliers, check/generate credentials, send mock emails
    for sid in rfq.supplier_ids:
        supplier_uuid = sid.value if hasattr(sid, "value") else uuid.UUID(str(sid))
        # Fetch supplier info
        sup_result = await uow.session.execute(
            select(SupplierModel)
            .options(selectinload(SupplierModel.contact))
            .where(SupplierModel.id == supplier_uuid)
        )
        supplier = sup_result.scalar_one_or_none()
        if not supplier:
            continue

        # Check if supplier_user exists
        su_result = await uow.session.execute(
            select(SupplierUserModel).where(SupplierUserModel.supplier_id == supplier_uuid)
        )
        sup_user = su_result.scalar_one_or_none()

        temp_password = None
        if not sup_user:
            # Generate username: supplier_code or clean name
            code = supplier.supplier_code or "".join(c for c in supplier.supplier_name if c.isalnum()).lower()[:10]
            username = f"supplier_{code.lower()}"
            # Generate secure temporary password
            temp_password = "".join(random.choices(string.ascii_letters + string.digits, k=8))
            password_hash = hashlib.sha256(temp_password.encode()).hexdigest()

            sup_user = SupplierUserModel(
                supplier_id=supplier_uuid,
                username=username,
                password_hash=password_hash,
                must_change_password=True,
            )
            uow.session.add(sup_user)
        else:
            username = sup_user.username
            if sup_user.must_change_password:
                # If they haven't changed it yet, reset to a new temp password
                temp_password = "".join(random.choices(string.ascii_letters + string.digits, k=8))
                password_hash = hashlib.sha256(temp_password.encode()).hexdigest()
                sup_user.password_hash = password_hash

        # Write mock email to file
        os.makedirs(os.path.join("media_uploads", "emails"), exist_ok=True)
        email_path = os.path.join("media_uploads", "emails", f"rfq_{rfq.rfq_number}_{username}.txt")

        # Format materials list
        materials_str = ""
        for idx, item in enumerate(rfq.items):
            materials_str += f"\nMaterial: {item.material_name}\nQuantity: {item.quantity} {item.uom}\nRequired Delivery: {item.required_delivery_date}\nWarehouse: {item.warehouse}\n"

        pwd_info = temp_password if temp_password else "[Use your existing secure password]"
        email_content = f"""Subject: Request for Quotation - {rfq.rfq_number}

Dear Supplier,

We request you to submit a quotation for the following materials:
{materials_str}
Please provide:
- Unit Price
- Available Quantity
- Delivery Time
- Expected Delivery Date
- Tax
- Freight Charges
- Payment Terms
- Quotation Validity
- Additional Conditions

Please use the following link to submit your quotation:

http://localhost:5173/submit-quotation?rfqId={rfq.id}

Username: {username}
Temporary Password: {pwd_info}
"""

        with open(email_path, "w", encoding="utf-8") as f:
            f.write(email_content)

        logger.info(f"Mock email for RFQ {rfq.rfq_number} saved to disk securely: {email_path}")

    await uow.session.flush()

    return _to_rfq_response(rfq)


@router.get("/rfqs/{rfq_id}", response_model=RfqResponse)
async def get_rfq(
    rfq_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> RfqResponse:
    repo = SqlAlchemyRfqRepository(uow.session)
    rfq = await repo.get_by_id(RfqId.of(rfq_id))
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ not found: {rfq_id}"
        )
    return _to_rfq_response(rfq)


@router.post("/rfqs/{rfq_id}/select-supplier", response_model=RfqResponse)
async def select_supplier(
    rfq_id: str,
    request: SelectSupplierRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> RfqResponse:
    repo = SqlAlchemyRfqRepository(uow.session)
    rfq = await repo.get_by_id(RfqId.of(rfq_id))
    if not rfq:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"RFQ not found: {rfq_id}"
        )
    rfq.select_supplier(
        supplier_id=SupplierId.of(request.supplier_id),
        selected_by=_user.username,
        selection_reason=request.selection_reason,
        selection_comments=request.selection_comments,
    )
    await repo.save(rfq)
    return _to_rfq_response(rfq)


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
        token=f"supplier-mock-token-{user.id}",
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
    return {"success": True}


@router.post("/auth/dev-login")
async def dev_login(
    request: DevLoginRequest,
) -> dict:
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
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid dev credentials configured in .env"
        )


# --- Quotation ---

@router.post("/quotations", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
async def submit_quotation(
    request: SubmitQuotationRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> QuotationResponse:
    from app.modules.procurement.application.commands import QuotationDocumentCommand
    repo = SqlAlchemyQuotationRepository(uow.session)
    rfq_repo = SqlAlchemyRfqRepository(uow.session)
    use_case = SubmitQuotationUseCase(repo, rfq_repo)
    command = SubmitQuotationCommand(
        rfq_id=request.rfq_id,
        supplier_id=request.supplier_id,
        lines=[
            QuotationLineCommand(
                item_code=l.item_code,
                quantity=l.quantity,
                unit_price=l.unit_price,
            )
            for l in request.lines
        ],
        status=request.status or "SUBMITTED",
        discount=request.discount,
        tax=request.tax,
        freight_charges=request.freight_charges,
        delivery_time=request.delivery_time,
        expected_delivery_date=request.expected_delivery_date,
        payment_terms=request.payment_terms,
        quotation_validity=request.quotation_validity,
        remarks=request.remarks,
        documents=[
            QuotationDocumentCommand(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
            )
            for d in request.documents
        ] if request.documents else []
    )
    q_id = await use_case.handle(command)
    q = await repo.get_by_id(q_id)
    return QuotationResponse(
        id=str(q.id),
        rfq_id=str(q.rfq_id),
        supplier_id=str(q.supplier_id),
        status=q.status,
        lines=[
            QuotationLineSchema(
                item_code=l.item_code,
                quantity=l.quantity,
                unit_price=l.unit_price,
            )
            for l in q.lines
        ],
        total_amount=q.total_amount,
        created_at=q.created_at,
        discount=q.discount,
        tax=q.tax,
        freight_charges=q.freight_charges,
        delivery_time=q.delivery_time,
        expected_delivery_date=q.expected_delivery_date,
        payment_terms=q.payment_terms,
        quotation_validity=q.quotation_validity,
        remarks=q.remarks,
        documents=[
            QuotationDocumentSchema(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
            )
            for d in q.documents
        ] if q.documents else []
    )


@router.get("/quotations", response_model=List[QuotationResponse])
async def list_quotations(
    supplier_id: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[QuotationResponse]:
    repo = SqlAlchemyQuotationRepository(uow.session)
    qs = await repo.list_all()
    if supplier_id:
        qs = [q for q in qs if str(q.supplier_id) == supplier_id]
    return [
        QuotationResponse(
            id=str(q.id),
            rfq_id=str(q.rfq_id),
            supplier_id=str(q.supplier_id),
            status=q.status,
            lines=[
                QuotationLineSchema(
                    item_code=l.item_code,
                    quantity=l.quantity,
                    unit_price=l.unit_price,
                )
                for l in q.lines
            ],
            total_amount=q.total_amount,
            created_at=q.created_at,
            discount=q.discount,
            tax=q.tax,
            freight_charges=q.freight_charges,
            delivery_time=q.delivery_time,
            expected_delivery_date=q.expected_delivery_date,
            payment_terms=q.payment_terms,
            quotation_validity=q.quotation_validity,
            remarks=q.remarks,
            documents=[
                QuotationDocumentSchema(
                    document_type=d.document_type,
                    file_name=d.file_name,
                    file_url=d.file_url,
                )
                for d in q.documents
            ] if q.documents else []
        )
        for q in qs
    ]


@router.put("/quotations/{quotation_id}", response_model=QuotationResponse)
async def update_quotation(
    quotation_id: str,
    request: UpdateQuotationRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> QuotationResponse:
    repo = SqlAlchemyQuotationRepository(uow.session)
    q = await repo.get_by_id(QuotationId.of(quotation_id))
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation not found: {quotation_id}"
        )
    if request.status is not None:
        q.status = request.status
    if request.remarks is not None:
        q.remarks = request.remarks
    await repo.save(q)
    return QuotationResponse(
        id=str(q.id),
        rfq_id=str(q.rfq_id),
        supplier_id=str(q.supplier_id),
        status=q.status,
        lines=[
            QuotationLineSchema(
                item_code=l.item_code,
                quantity=l.quantity,
                unit_price=l.unit_price,
            )
            for l in q.lines
        ],
        total_amount=q.total_amount,
        created_at=q.created_at,
        discount=q.discount,
        tax=q.tax,
        freight_charges=q.freight_charges,
        delivery_time=q.delivery_time,
        expected_delivery_date=q.expected_delivery_date,
        payment_terms=q.payment_terms,
        quotation_validity=q.quotation_validity,
        remarks=q.remarks,
        documents=[
            QuotationDocumentSchema(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
            )
            for d in q.documents
        ] if q.documents else []
    )


@router.get("/quotations/{quotation_id}", response_model=QuotationResponse)
async def get_quotation(
    quotation_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> QuotationResponse:
    repo = SqlAlchemyQuotationRepository(uow.session)
    q = await repo.get_by_id(QuotationId.of(quotation_id))
    if not q:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Quotation not found: {quotation_id}"
        )
    return QuotationResponse(
        id=str(q.id),
        rfq_id=str(q.rfq_id),
        supplier_id=str(q.supplier_id),
        status=q.status,
        lines=[
            QuotationLineSchema(
                item_code=l.item_code,
                quantity=l.quantity,
                unit_price=l.unit_price,
            )
            for l in q.lines
        ],
        total_amount=q.total_amount,
        created_at=q.created_at,
        discount=q.discount,
        tax=q.tax,
        freight_charges=q.freight_charges,
        delivery_time=q.delivery_time,
        expected_delivery_date=q.expected_delivery_date,
        payment_terms=q.payment_terms,
        quotation_validity=q.quotation_validity,
        remarks=q.remarks,
        documents=[
            QuotationDocumentSchema(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
            )
            for d in q.documents
        ] if q.documents else []
    )


# --- Purchase Order ---

async def _to_purchase_order_response(po: PurchaseOrder, session: AsyncSession) -> PurchaseOrderResponse:
    import logging
    logger = logging.getLogger(__name__)
    try:
        from app.modules.procurement.infrastructure.api.schemas import PurchaseOrderSummarySchema

        # 1. Fetch Supplier summary for the header
        supplier_info = None
        try:
            supplier_stmt = select(SupplierModel).where(SupplierModel.id == po.supplier_id.value)
            supplier_result = await session.execute(supplier_stmt)
            supplier = supplier_result.scalar_one_or_none()
            if supplier:
                supplier_info = SupplierResponse(
                    supplier_id=str(supplier.id),
                    supplier_name=supplier.supplier_name,
                    registered_company_name=supplier.registered_company_name,
                    vendor_type=supplier.vendor_type,
                    category=supplier.category,
                    industry=supplier.industry,
                    gstin=supplier.gstin,
                    supplier_code=supplier.supplier_code,
                    status=supplier.status,
                    rating=float(supplier.rating) if supplier.rating is not None else 0.0,
                    performance_score=float(supplier.performance_score) if supplier.performance_score is not None else 0.0
                )
        except Exception as e:
            logger.warning(f"Failed to fetch supplier info for PO {po.po_number}: {e}")

        # 2. Fetch Quotation Details if linked
        quotation_info = None
        if po.quotation_id:
            try:
                q_stmt = select(QuotationModel).where(QuotationModel.id == po.quotation_id.value)
                q_res = await session.execute(q_stmt)
                q = q_res.scalar_one_or_none()
                if q:
                    quotation_info = QuotationResponse(
                        id=str(q.id),
                        rfq_id=str(q.rfq_id),
                        supplier_id=str(q.supplier_id),
                        status=q.status,
                        lines=[],
                        total_amount=q.total_amount,
                        created_at=q.created_at,
                        discount=q.discount,
                        tax=q.tax,
                        freight_charges=q.freight_charges,
                        delivery_time=q.delivery_time,
                        expected_delivery_date=q.expected_delivery_date,
                        payment_terms=q.payment_terms,
                        remarks=q.remarks,
                    )
            except Exception as e:
                logger.warning(f"Failed to fetch quotation info for PO {po.po_number}: {e}")

        lines = []
        for l in po.lines:
            try:
                lines.append(
                    PurchaseOrderLineSchema(
                        item_code=l.item_code,
                        ordered_quantity=l.ordered_quantity or Decimal("0.0"),
                        unit_price=l.unit_price or Decimal("0.0"),
                        material_name=l.material_name,
                        category=l.category,
                        uom=l.uom or "PCS",
                        discount=l.discount or Decimal("0.0"),
                        tax=l.tax or Decimal("0.0"),
                        line_total=l.line_total or Decimal("0.0"),
                    )
                )
            except Exception as le:
                logger.warning(f"Failed to map line {l.item_code} for PO {po.po_number}: {le}")

        return PurchaseOrderResponse(
            id=str(po.id),
            po_number=po.po_number,
            quotation_id=str(po.quotation_id) if po.quotation_id else None,
            supplier_id=str(po.supplier_id),
            status=po.status,
            lines=lines,
            po_date=po.po_date,
            expected_delivery_date=po.expected_delivery_date,
            created_at=po.created_at,
            rejection_reason=po.rejection_reason,
            finance_comments=po.finance_comments,
            logs=[
                PurchaseOrderApprovalLogSchema(
                    id=str(log.id),
                    status=log.status,
                    actor=log.actor,
                    action_date=log.action_date,
                    reason=log.reason,
                    comments=log.comments,
                )
                for log in po.logs
            ] if po.logs else [],
            supplier_info=supplier_info,
            quotation_info=quotation_info,
            department=getattr(po, "department", "Procurement"),
            procurement_officer=getattr(po, "procurement_officer", "Procurement Officer"),
            delivery_warehouse=getattr(po, "delivery_warehouse", "Pune DC · Plant 1200"),
            delivery_address=getattr(po, "delivery_address", "Sector 18, Industrial Area, Pune, MH, 411018"),
            additional_charges=po.additional_charges or Decimal("0.0"),
            summary=PurchaseOrderSummarySchema(
                subtotal=po.subtotal or Decimal("0.0"),
                total_discount=po.total_discount or Decimal("0.0"),
                tax_amount=po.tax_amount or Decimal("0.0"),
                additional_charges=po.additional_charges or Decimal("0.0"),
                grand_total=po.grand_total or Decimal("0.0"),
            ),
        )
    except Exception as e:
        logger.error(f"Error mapping PO {po.id} to response: {e}", exc_info=True)
        # Return a partially valid response instead of crashing
        return PurchaseOrderResponse(
            id=str(po.id),
            po_number=po.po_number,
            supplier_id=str(po.supplier_id),
            status="ERROR",
            lines=[],
            po_date=po.po_date,
            created_at=po.created_at,
            summary=PurchaseOrderSummarySchema(
                subtotal=Decimal("0.0"),
                total_discount=Decimal("0.0"),
                tax_amount=Decimal("0.0"),
                additional_charges=Decimal("0.0"),
                grand_total=Decimal("0.0"),
            )
        )


@router.post("/purchase-orders", response_model=PurchaseOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    request: CreatePurchaseOrderRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> PurchaseOrderResponse:
    repo = SqlAlchemyPurchaseOrderRepository(uow.session)
    use_case = CreatePurchaseOrderUseCase(repo)
    command = CreatePurchaseOrderCommand(
        supplier_id=request.supplier_id,
        lines=[
            PurchaseOrderLineCommand(
                item_code=l.item_code,
                ordered_quantity=l.ordered_quantity,
                unit_price=l.unit_price,
                material_name=l.material_name,
                category=l.category,
                uom=l.uom,
                discount=l.discount or Decimal("0.0"),
                tax=l.tax or Decimal("0.0"),
            )
            for l in request.lines
        ],
        quotation_id=request.quotation_id,
        po_number=request.po_number,
        po_date=request.po_date,
        expected_delivery_date=getattr(request, "expected_delivery_date", None),
        department=getattr(request, "department", None),
        procurement_officer=getattr(request, "procurement_officer", None),
        delivery_warehouse=getattr(request, "delivery_warehouse", None),
        delivery_address=getattr(request, "delivery_address", None),
        additional_charges=getattr(request, "additional_charges", Decimal("0.0")),
    )
    po_id = await use_case.handle(command)
    po = await repo.get_by_id(po_id)
    return await _to_purchase_order_response(po, uow.session)


@router.get("/purchase-orders", response_model=List[PurchaseOrderResponse])
async def list_purchase_orders(
    supplier_id: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[PurchaseOrderResponse]:
    import logging
    logger = logging.getLogger(__name__)
    try:
        repo = SqlAlchemyPurchaseOrderRepository(uow.session)
        pos = await repo.list_all()
        if supplier_id:
            pos = [p for p in pos if str(p.supplier_id) == supplier_id]

        responses = []
        for p in pos:
            try:
                responses.append(await _to_purchase_order_response(p, uow.session))
            except Exception as e:
                logger.warning(f"Skipping PO {p.po_number} due to mapping error: {e}")
        return responses
    except Exception as e:
        logger.error(f"Failed to list purchase orders: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Database or Repository error: {str(e)}")


@router.put("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def update_purchase_order(
    po_id: str,
    request: UpdatePurchaseOrderRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> PurchaseOrderResponse:
    repo = SqlAlchemyPurchaseOrderRepository(uow.session)
    po = await repo.get_by_id(PurchaseOrderId.of(po_id))
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order not found: {po_id}"
        )
    if request.lines is not None:
        from app.modules.procurement.domain.purchase_order import PurchaseOrderLine
        po.lines = [
            PurchaseOrderLine(
                item_code=l.item_code,
                ordered_quantity=l.ordered_quantity,
                unit_price=l.unit_price,
                material_name=l.material_name,
                category=l.category,
                uom=l.uom,
                discount=l.discount or Decimal("0.0"),
                tax=l.tax or Decimal("0.0"),
            )
            for l in request.lines
        ]
    if request.status == "APPROVED" or request.status == "PLACED":
        if not po.po_number or po.po_number.startswith("PROP-") or len(po.po_number) > 20:
            from datetime import datetime
            year = datetime.now().year
            seq = await repo.get_next_sequence(year)
            po.po_number = f"PO-{year}-{seq:04d}"
        po.approve(actor=_user.username, comments=request.finance_comments)
    elif request.status == "REJECTED":
        if not request.rejection_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejection reason is mandatory"
            )
        po.reject(actor=_user.username, reason=request.rejection_reason, comments=request.finance_comments)
    else:
        po.status = request.status

    if getattr(request, "additional_charges", None) is not None:
        po.additional_charges = request.additional_charges
    await repo.save(po)
    return await _to_purchase_order_response(po, uow.session)


@router.post("/purchase-orders/{po_id}/send-supplier-email", response_model=NotificationDispatchResponse)
async def send_po_supplier_email(
    po_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> NotificationDispatchResponse:
    from app.modules.procurement.application.use_cases import SendPOSupplierNotificationUseCase
    repo = SqlAlchemyPurchaseOrderRepository(uow.session)
    use_case = SendPOSupplierNotificationUseCase(repo)
    try:
        res = await use_case.execute(po_id)
        await uow.session.commit()
        return NotificationDispatchResponse(
            total_notifications_sent=1,
            status="SENT",
            details=res,
        )
    except Exception as e:
        await uow.session.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/purchase-orders/{po_id}/pdf")
async def download_purchase_order_pdf(
    po_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
):
    from app.modules.procurement.application.use_cases import GeneratePurchaseOrderPdfUseCase
    repo = SqlAlchemyPurchaseOrderRepository(uow.session)
    use_case = GeneratePurchaseOrderPdfUseCase(repo)
    try:
        pdf_bytes = await use_case.handle(po_id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=PO-{po_id}.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/purchase-orders/{po_id}", response_model=PurchaseOrderResponse)
async def get_purchase_order(
    po_id: str,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> PurchaseOrderResponse:
    repo = SqlAlchemyPurchaseOrderRepository(uow.session)
    po = await repo.get_by_id(PurchaseOrderId.of(po_id))
    if not po:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Purchase order not found: {po_id}"
        )
    return await _to_purchase_order_response(po, uow.session)


# --- ASN ---

@router.post("/asns", response_model=AsnResponse, status_code=status.HTTP_201_CREATED)
async def create_asn(
    request: CreateAsnRequest,
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> AsnResponse:
    repo = SqlAlchemyAsnRepository(uow.session)
    po_repo = SqlAlchemyPurchaseOrderRepository(uow.session)
    use_case = CreateAsnUseCase(repo, po_repo)
    command = CreateAsnCommand(
        po_id=request.po_id,
        asn_number=request.asn_number,
        lines=[
            AsnLineCommand(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
            )
            for l in request.lines
        ],
        vehicle_number=request.vehicle_number,
        expected_arrival_at=request.expected_arrival_at,
        shipment_date=request.shipment_date,
        driver_name=request.driver_name,
        driver_contact=request.driver_contact,
    )
    asn_id = await use_case.handle(command)
    asn = await repo.get_by_id(asn_id)
    return AsnResponse(
        id=str(asn.id),
        po_id=str(asn.po_id),
        asn_number=asn.asn_number,
        status=asn.status,
        lines=[
            AsnLineSchema(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
            )
            for l in asn.lines
        ],
        vehicle_number=asn.vehicle_number,
        expected_arrival_at=asn.expected_arrival_at,
        shipment_date=asn.shipment_date,
        driver_name=asn.driver_name,
        driver_contact=asn.driver_contact,
        created_at=asn.created_at,
    )


@router.get("/asns/next-number")
async def get_next_asn_number(
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> dict:
    from app.modules.procurement.application.use_cases import GetNextAsnNumberUseCase
    repo = SqlAlchemyAsnRepository(uow.session)
    use_case = GetNextAsnNumberUseCase(repo)
    asn_number = await use_case.handle()
    return {"asn_number": asn_number}


@router.get("/asns", response_model=List[AsnResponse])
async def list_asns(
    supplier_id: Optional[str] = Query(None),
    uow: UnitOfWork = Depends(get_uow),
    _user: CurrentUser = Depends(get_current_user),
) -> List[AsnResponse]:
    repo = SqlAlchemyAsnRepository(uow.session)
    asns = await repo.list_all()
    if supplier_id:
        po_repo = SqlAlchemyPurchaseOrderRepository(uow.session)
        pos = await po_repo.list_all()
        supplier_po_ids = {str(po.id) for po in pos if str(po.supplier_id) == supplier_id}
        asns = [asn for asn in asns if str(asn.po_id) in supplier_po_ids]
    return [
        AsnResponse(
            id=str(asn.id),
            po_id=str(asn.po_id),
            asn_number=asn.asn_number,
            status=asn.status,
            lines=[
                AsnLineSchema(
                    item_code=l.item_code,
                    shipped_quantity=l.shipped_quantity,
                )
                for l in asn.lines
            ],
            vehicle_number=asn.vehicle_number,
            expected_arrival_at=asn.expected_arrival_at,
            shipment_date=asn.shipment_date,
            driver_name=asn.driver_name,
            driver_contact=asn.driver_contact,
            created_at=asn.created_at,
        )
        for asn in asns
    ]
