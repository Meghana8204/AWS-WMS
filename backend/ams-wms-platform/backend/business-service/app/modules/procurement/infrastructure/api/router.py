"""
FastAPI router for Procurement operations and full pipeline lifecycle.
"""
from __future__ import annotations

import os
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.modules.procurement.application.commands import (
    ApproveFinanceCommand,
    ASNAttachmentDTO,
    ASNItemDTO,
    CreateMaterialRequestCommand,
    CreatePurchaseOrderCommand,
    CreateRFQCommand,
    DeliveryDetailsDTO,
    MaterialRequestItemDTO,
    OrderItemDTO,
    QuotationItemDTO,
    RejectFinanceCommand,
    ResubmitPurchaseOrderCommand,
    RFQItemDTO,
    RFQSupplierDTO,
    SaveDraftPurchaseOrderCommand,
    SelectQuotationCommand,
    SendPOSupplierEmailCommand,
    SendRFQEmailsCommand,
    SubmitASNCommand,
    SubmitQuotationCommand,
    SupplierInfoDTO,
    UpdatePurchaseOrderCommand,
    UploadAttachmentCommand,
)
from app.modules.procurement.application.queries import ListPurchaseOrdersQuery
from app.modules.procurement.application.use_cases import (
    ApproveFinanceUseCase,
    ApproveMaterialRequestUseCase,
    CancelPurchaseOrderUseCase,
    CreateMaterialRequestUseCase,
    CreatePurchaseOrderUseCase,
    CreateRFQUseCase,
    GeneratePurchaseOrderPdfUseCase,
    GetPurchaseOrderUseCase,
    GetQuotationComparisonMatrixUseCase,
    ListPurchaseOrdersUseCase,
    PublishRFQUseCase,
    RejectFinanceUseCase,
    ResubmitPurchaseOrderUseCase,
    SaveDraftPurchaseOrderUseCase,
    SelectSupplierQuotationUseCase,
    SendPOSupplierNotificationUseCase,
    SendRFQEmailToSuppliersUseCase,
    SubmitASNUseCase,
    SubmitMaterialRequestUseCase,
    SubmitQuotationUseCase,
    UpdatePurchaseOrderUseCase,
    UploadAttachmentUseCase,
)
from app.modules.procurement.domain.purchase_order import PurchaseOrder, PurchaseOrderValidationError
from app.modules.procurement.infrastructure.api.schemas import (
    ArrivalNotificationResponseSchema,
    ASNItemSchema,
    ASNResponseSchema,
    ASNSubmitSchema,
    AttachmentResponseSchema,
    ComparisonMatrixResponseSchema,
    CreateMaterialRequestSchema,
    CreatePurchaseOrderRequestSchema,
    CreateRFQSchema,
    DeliveryDetailsSchema,
    FinanceApprovalDecisionSchema,
    FinanceApprovalResponseSchema,
    MaterialRequestItemSchema,
    MaterialRequestResponseSchema,
    NotificationDispatchResponseSchema,
    OrderItemResponseSchema,
    OrderItemSchema,
    OrderSummarySchema,
    PurchaseOrderListResponseSchema,
    PurchaseOrderResponseSchema,
    QuotationItemSchema,
    QuotationResponseSchema,
    QuotationSubmitSchema,
    ResubmitPurchaseOrderRequestSchema,
    RFQCreateSchema,
    RFQItemSchema,
    RFQResponseSchema,
    RFQSupplierSchema,
    SaveDraftPurchaseOrderRequestSchema,
    SelectQuotationSchema,
    SupplierInfoSchema,
    UpdatePurchaseOrderRequestSchema,
)
from app.modules.procurement.infrastructure.persistence.repository_impl import (
    SqlAlchemyArrivalNotificationRepository,
    SqlAlchemyASNRepository,
    SqlAlchemyFinanceApprovalRepository,
    SqlAlchemyMaterialRequestRepository,
    SqlAlchemyPurchaseOrderRepository,
    SqlAlchemyQuotationRepository,
    SqlAlchemyRFQRepository,
)

router = APIRouter(prefix="/api/v1/procurement", tags=["Procurement & Purchase Orders"])


def _map_po_to_response(po: PurchaseOrder) -> PurchaseOrderResponseSchema:
    supp = po.supplier_info
    deliv = po.delivery_details

    return PurchaseOrderResponseSchema(
        id=str(po.id.value),
        po_number=po.po_number,
        po_date=po.po_date,
        status=po.status.value,
        supplier_id=po.supplier_id,
        warehouse_id=po.warehouse_id,
        department=po.department,
        buyer=po.buyer,
        expected_delivery_date=po.expected_delivery_date,
        payment_terms=po.payment_terms,
        rfq_id=po.rfq_id,
        quotation_id=po.quotation_id,
        finance_approval_id=po.finance_approval_id,
        supplier_info=SupplierInfoSchema(
            supplier_code=supp.supplier_code,
            supplier_name=supp.supplier_name,
            contact_person=supp.contact_person,
            phone=supp.phone,
            email=supp.email,
            gst_number=supp.gst_number,
            supplier_address=supp.supplier_address,
        ) if supp else None,
        delivery_details=DeliveryDetailsSchema(
            delivery_warehouse=deliv.delivery_warehouse,
            delivery_address=deliv.delivery_address,
            expected_delivery_date=deliv.expected_delivery_date,
            transporter=deliv.transporter,
        ) if deliv else None,
        items=[
            OrderItemResponseSchema(
                id=str(it.id),
                material_code=it.material_code,
                material_name=it.material_name,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                quantity=it.quantity,
                unit_price=it.unit_price,
                discount=it.discount,
                tax=it.tax,
                line_total=it.line_total,
            )
            for it in po.items
        ],
        attachments=[
            AttachmentResponseSchema(
                id=str(att.id),
                filename=att.filename,
                file_type=att.file_type,
                file_size_bytes=att.file_size_bytes,
                category=att.category.value,
                created_at=att.created_at,
                download_url=f"/api/v1/procurement/purchase-orders/{po.id.value}/attachments/{att.id}",
            )
            for att in po.attachments
        ],
        tax_rate=po.tax_rate,
        summary=OrderSummarySchema(
            total_items=po.total_items,
            total_quantity=po.total_quantity,
            subtotal=po.subtotal,
            total_discount=po.total_discount,
            tax_amount=po.tax_amount,
            additional_charges=po.additional_charges,
            grand_total=po.grand_total,
        ),
        created_at=po.created_at,
        updated_at=po.updated_at,
    )


# --- Section 1: Material Requests (Requisitions) ---

@router.post("/material-requests", response_model=MaterialRequestResponseSchema, status_code=status.HTTP_201_CREATED)
async def create_material_request(dto: CreateMaterialRequestSchema, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyMaterialRequestRepository(db)
    use_case = CreateMaterialRequestUseCase(repo)
    cmd = CreateMaterialRequestCommand(
        warehouse_id=dto.warehouse_id,
        department=dto.department,
        requested_by=dto.requested_by,
        target_delivery_date=dto.target_delivery_date,
        items=[
            MaterialRequestItemDTO(
                material_code=it.material_code,
                material_name=it.material_name,
                requested_qty=it.requested_qty,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                estimated_unit_cost=it.estimated_unit_cost,
                notes=it.notes,
            )
            for it in dto.items
        ],
        priority=dto.priority,
    )
    req = await use_case.execute(cmd)
    await db.commit()
    return MaterialRequestResponseSchema(
        id=req.id,
        request_number=req.request_number,
        warehouse_id=req.warehouse_id,
        department=req.department,
        requested_by=req.requested_by,
        target_delivery_date=req.target_delivery_date,
        priority=req.priority.value,
        status=req.status.value,
        rejection_reason=req.rejection_reason,
        items=[
            MaterialRequestItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                requested_qty=it.requested_qty,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                estimated_unit_cost=it.estimated_unit_cost,
                notes=it.notes,
            )
            for it in req.items
        ],
        total_estimated_cost=req.total_estimated_cost,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.post("/material-requests/{id}/submit", response_model=MaterialRequestResponseSchema)
async def submit_material_request(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyMaterialRequestRepository(db)
    use_case = SubmitMaterialRequestUseCase(repo)
    req = await use_case.execute(id)
    await db.commit()
    return MaterialRequestResponseSchema(
        id=req.id,
        request_number=req.request_number,
        warehouse_id=req.warehouse_id,
        department=req.department,
        requested_by=req.requested_by,
        target_delivery_date=req.target_delivery_date,
        priority=req.priority.value,
        status=req.status.value,
        rejection_reason=req.rejection_reason,
        items=[
            MaterialRequestItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                requested_qty=it.requested_qty,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                estimated_unit_cost=it.estimated_unit_cost,
                notes=it.notes,
            )
            for it in req.items
        ],
        total_estimated_cost=req.total_estimated_cost,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.post("/material-requests/{id}/approve", response_model=MaterialRequestResponseSchema)
async def approve_material_request(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyMaterialRequestRepository(db)
    use_case = ApproveMaterialRequestUseCase(repo)
    req = await use_case.execute(id)
    await db.commit()
    return MaterialRequestResponseSchema(
        id=req.id,
        request_number=req.request_number,
        warehouse_id=req.warehouse_id,
        department=req.department,
        requested_by=req.requested_by,
        target_delivery_date=req.target_delivery_date,
        priority=req.priority.value,
        status=req.status.value,
        rejection_reason=req.rejection_reason,
        items=[
            MaterialRequestItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                requested_qty=it.requested_qty,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                estimated_unit_cost=it.estimated_unit_cost,
                notes=it.notes,
            )
            for it in req.items
        ],
        total_estimated_cost=req.total_estimated_cost,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.get("/material-requests", response_model=list[MaterialRequestResponseSchema])
async def list_material_requests(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = SqlAlchemyMaterialRequestRepository(db)
    items, total = await repo.list_all(status=status, warehouse_id=warehouse_id, skip=skip, limit=limit)
    return [
        MaterialRequestResponseSchema(
            id=req.id,
            request_number=req.request_number,
            warehouse_id=req.warehouse_id,
            department=req.department,
            requested_by=req.requested_by,
            target_delivery_date=req.target_delivery_date,
            priority=req.priority.value,
            status=req.status.value,
            rejection_reason=req.rejection_reason,
            items=[
                MaterialRequestItemSchema(
                    material_code=it.material_code,
                    material_name=it.material_name,
                    requested_qty=it.requested_qty,
                    category=it.category,
                    unit_of_measure=it.unit_of_measure,
                    estimated_unit_cost=it.estimated_unit_cost,
                    notes=it.notes,
                )
                for it in req.items
            ],
            total_estimated_cost=req.total_estimated_cost,
            created_at=req.created_at,
            updated_at=req.updated_at,
        )
        for req in items
    ]


# --- Section 2: Request For Quotation (RFQ) ---

@router.post("/rfqs", response_model=RFQResponseSchema, status_code=status.HTTP_201_CREATED)
async def create_rfq(dto: RFQCreateSchema, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyRFQRepository(db)
    mr_repo = SqlAlchemyMaterialRequestRepository(db)
    use_case = CreateRFQUseCase(repo, mr_repo)
    cmd = CreateRFQCommand(
        title=dto.title,
        warehouse_id=dto.warehouse_id,
        due_date=dto.due_date,
        items=[
            RFQItemDTO(
                material_code=it.material_code,
                material_name=it.material_name,
                quantity=it.quantity,
                unit_of_measure=it.unit_of_measure,
            )
            for it in dto.items
        ],
        invited_suppliers=[
            RFQSupplierDTO(
                supplier_id=s.supplier_id,
                supplier_code=s.supplier_code,
                supplier_name=s.supplier_name,
                email=s.email,
            )
            for s in dto.invited_suppliers
        ],
        material_request_ids=dto.material_request_ids,
        terms_and_conditions=dto.terms_and_conditions,
    )
    rfq = await use_case.execute(cmd)
    await db.commit()
    return RFQResponseSchema(
        id=rfq.id,
        rfq_number=rfq.rfq_number,
        title=rfq.title,
        warehouse_id=rfq.warehouse_id,
        issue_date=rfq.issue_date,
        due_date=rfq.due_date,
        status=rfq.status.value,
        material_request_ids=rfq.material_request_ids,
        terms_and_conditions=rfq.terms_and_conditions,
        items=[
            RFQItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                quantity=it.quantity,
                unit_of_measure=it.unit_of_measure,
            )
            for it in rfq.items
        ],
        invited_suppliers=[
            RFQSupplierSchema(
                supplier_id=s.supplier_id,
                supplier_code=s.supplier_code,
                supplier_name=s.supplier_name,
                email=s.email,
            )
            for s in rfq.invited_suppliers
        ],
        created_at=rfq.created_at,
        updated_at=rfq.updated_at,
    )


@router.post("/rfqs/{id}/publish", response_model=RFQResponseSchema)
async def publish_rfq(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyRFQRepository(db)
    use_case = PublishRFQUseCase(repo)
    rfq = await use_case.execute(id)
    await db.commit()
    return RFQResponseSchema(
        id=rfq.id,
        rfq_number=rfq.rfq_number,
        title=rfq.title,
        warehouse_id=rfq.warehouse_id,
        issue_date=rfq.issue_date,
        due_date=rfq.due_date,
        status=rfq.status.value,
        material_request_ids=rfq.material_request_ids,
        terms_and_conditions=rfq.terms_and_conditions,
        items=[
            RFQItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                quantity=it.quantity,
                unit_of_measure=it.unit_of_measure,
            )
            for it in rfq.items
        ],
        invited_suppliers=[
            RFQSupplierSchema(
                supplier_id=s.supplier_id,
                supplier_code=s.supplier_code,
                supplier_name=s.supplier_name,
                email=s.email,
            )
            for s in rfq.invited_suppliers
        ],
        created_at=rfq.created_at,
        updated_at=rfq.updated_at,
    )


@router.get("/rfqs/{id}/comparison-matrix", response_model=ComparisonMatrixResponseSchema)
async def get_quotation_comparison_matrix(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    rfq_repo = SqlAlchemyRFQRepository(db)
    quo_repo = SqlAlchemyQuotationRepository(db)
    use_case = GetQuotationComparisonMatrixUseCase(rfq_repo, quo_repo)
    try:
        matrix = await use_case.execute(id)
        return ComparisonMatrixResponseSchema(**matrix)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/rfqs/{id}/send-emails", response_model=NotificationDispatchResponseSchema)
async def send_rfq_emails(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    rfq_repo = SqlAlchemyRFQRepository(db)
    use_case = SendRFQEmailToSuppliersUseCase(rfq_repo)
    try:
        res = await use_case.execute(id)
        await db.commit()
        return NotificationDispatchResponseSchema(
            total_notifications_sent=res["total_emails_sent"],
            status="SENT",
            details=res.get("notifications") or res.get("details") or [],
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# --- Section 3: Supplier Quotations & Selection ---

@router.post("/quotations", response_model=QuotationResponseSchema, status_code=status.HTTP_201_CREATED)
async def submit_quotation(dto: QuotationSubmitSchema, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyQuotationRepository(db)
    rfq_repo = SqlAlchemyRFQRepository(db)
    use_case = SubmitQuotationUseCase(repo, rfq_repo)
    cmd = SubmitQuotationCommand(
        rfq_id=dto.rfq_id,
        supplier_id=dto.supplier_id,
        supplier_code=dto.supplier_code,
        supplier_name=dto.supplier_name,
        valid_until=dto.valid_until,
        items=[
            QuotationItemDTO(
                material_code=it.material_code,
                material_name=it.material_name,
                offered_qty=it.offered_qty,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate,
                discount_percent=it.discount_percent,
            )
            for it in dto.items
        ],
        payment_terms=dto.payment_terms,
        delivery_lead_time_days=dto.delivery_lead_time_days,
    )
    quo = await use_case.execute(cmd)
    await db.commit()
    return QuotationResponseSchema(
        id=quo.id,
        quotation_number=quo.quotation_number,
        rfq_id=quo.rfq_id,
        supplier_id=quo.supplier_id,
        supplier_code=quo.supplier_code,
        supplier_name=quo.supplier_name,
        submission_date=quo.submission_date,
        valid_until=quo.valid_until,
        payment_terms=quo.payment_terms,
        delivery_lead_time_days=quo.delivery_lead_time_days,
        status=quo.status.value,
        rejection_reason=quo.rejection_reason,
        items=[
            QuotationItemSchema(
                material_code=it.material_code,
                material_name=it.material_name,
                offered_qty=it.offered_qty,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate,
                discount_percent=it.discount_percent,
            )
            for it in quo.items
        ],
        subtotal=quo.subtotal,
        tax_amount=quo.tax_amount,
        grand_total=quo.grand_total,
        created_at=quo.created_at,
        updated_at=quo.updated_at,
    )


@router.post("/rfqs/{rfq_id}/quotations/{quotation_id}/select", response_model=PurchaseOrderResponseSchema)
async def select_quotation(
    rfq_id: str,
    quotation_id: str,
    dto: SelectQuotationSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    quo_repo = SqlAlchemyQuotationRepository(db)
    rfq_repo = SqlAlchemyRFQRepository(db)
    po_repo = SqlAlchemyPurchaseOrderRepository(db)
    fa_repo = SqlAlchemyFinanceApprovalRepository(db)
    use_case = SelectSupplierQuotationUseCase(quo_repo, rfq_repo, po_repo, fa_repo)
    cmd = SelectQuotationCommand(
        rfq_id=rfq_id,
        quotation_id=quotation_id,
        selected_by=dto.selected_by,
        selection_notes=dto.selection_notes,
    )
    quo, po, fa = await use_case.execute(cmd)
    await db.commit()
    return _map_po_to_response(po)


# --- Section 4: Finance Approval ---

@router.get("/finance-approvals", response_model=list[FinanceApprovalResponseSchema])
async def list_finance_approvals(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = SqlAlchemyFinanceApprovalRepository(db)
    items, total = await repo.list_all(status=status, skip=skip, limit=limit)
    return [
        FinanceApprovalResponseSchema(
            id=fa.id,
            po_id=fa.po_id,
            po_number=fa.po_number,
            total_amount=fa.total_amount,
            requested_by=fa.requested_by,
            budget_code=fa.budget_code,
            currency=fa.currency,
            status=fa.status.value,
            approver_id=fa.approver_id,
            approver_name=fa.approver_name,
            approval_notes=fa.approval_notes,
            rejection_reason=fa.rejection_reason,
            requires_cfo_approval=fa.requires_cfo_approval,
            created_at=fa.created_at,
            updated_at=fa.updated_at,
        )
        for fa in items
    ]


@router.post("/finance-approvals/{id}/approve", response_model=FinanceApprovalResponseSchema)
async def approve_finance(
    id: str,
    dto: FinanceApprovalDecisionSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    fa_repo = SqlAlchemyFinanceApprovalRepository(db)
    po_repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = ApproveFinanceUseCase(fa_repo, po_repo)
    cmd = ApproveFinanceCommand(
        approval_id=id,
        approver_id=dto.approver_id,
        approver_name=dto.approver_name,
        notes=dto.notes_or_reason,
    )
    fa, po = await use_case.execute(cmd)
    await db.commit()
    return FinanceApprovalResponseSchema(
        id=fa.id,
        po_id=fa.po_id,
        po_number=fa.po_number,
        total_amount=fa.total_amount,
        requested_by=fa.requested_by,
        budget_code=fa.budget_code,
        currency=fa.currency,
        status=fa.status.value,
        approver_id=fa.approver_id,
        approver_name=fa.approver_name,
        approval_notes=fa.approval_notes,
        rejection_reason=fa.rejection_reason,
        requires_cfo_approval=fa.requires_cfo_approval,
        created_at=fa.created_at,
        updated_at=fa.updated_at,
    )


@router.post("/finance-approvals/{id}/reject", response_model=FinanceApprovalResponseSchema)
async def reject_finance(
    id: str,
    dto: FinanceApprovalDecisionSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    fa_repo = SqlAlchemyFinanceApprovalRepository(db)
    po_repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = RejectFinanceUseCase(fa_repo, po_repo)
    cmd = RejectFinanceCommand(
        approval_id=id,
        approver_id=dto.approver_id,
        approver_name=dto.approver_name,
        reason=dto.notes_or_reason,
    )
    fa, po = await use_case.execute(cmd)
    await db.commit()
    return FinanceApprovalResponseSchema(
        id=fa.id,
        po_id=fa.po_id,
        po_number=fa.po_number,
        total_amount=fa.total_amount,
        requested_by=fa.requested_by,
        budget_code=fa.budget_code,
        currency=fa.currency,
        status=fa.status.value,
        approver_id=fa.approver_id,
        approver_name=fa.approver_name,
        approval_notes=fa.approval_notes,
        rejection_reason=fa.rejection_reason,
        requires_cfo_approval=fa.requires_cfo_approval,
        created_at=fa.created_at,
        updated_at=fa.updated_at,
    )


@router.post("/purchase-orders/{id}/resubmit", response_model=PurchaseOrderResponseSchema)
async def resubmit_purchase_order(
    id: str,
    dto: ResubmitPurchaseOrderRequestSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    po_repo = SqlAlchemyPurchaseOrderRepository(db)
    fa_repo = SqlAlchemyFinanceApprovalRepository(db)
    use_case = ResubmitPurchaseOrderUseCase(po_repo, fa_repo)
    items_dto = None
    if dto.items is not None:
        items_dto = [OrderItemDTO(**it.model_dump()) for it in dto.items]
    cmd = ResubmitPurchaseOrderCommand(
        po_id=id,
        resubmitted_by=dto.resubmitted_by,
        items=items_dto,
        tax_rate=dto.tax_rate,
    )
    try:
        po, fa = await use_case.execute(cmd)
        await db.commit()
        return _map_po_to_response(po)
    except PurchaseOrderValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/purchase-orders/{id}/send-supplier-email", response_model=NotificationDispatchResponseSchema)
async def send_po_supplier_email(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    po_repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = SendPOSupplierNotificationUseCase(po_repo)
    try:
        res = await use_case.execute(id)
        await db.commit()
        return NotificationDispatchResponseSchema(
            total_notifications_sent=1,
            status="SENT",
            details=res,
        )
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# --- Section 5: Purchase Orders ---

@router.post("/purchase-orders", response_model=PurchaseOrderResponseSchema, status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    dto: CreatePurchaseOrderRequestSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = CreatePurchaseOrderUseCase(repo)
    cmd = CreatePurchaseOrderCommand(
        supplier_id=dto.supplier_id,
        warehouse_id=dto.warehouse_id,
        expected_delivery_date=dto.expected_delivery_date,
        po_number=dto.po_number,
        po_date=dto.po_date,
        department=dto.department,
        buyer=dto.buyer,
        payment_terms=dto.payment_terms,
        rfq_id=dto.rfq_id,
        quotation_id=dto.quotation_id,
        material_request_ids=dto.material_request_ids,
        supplier_info=SupplierInfoDTO(**dto.supplier_info.model_dump()) if dto.supplier_info else None,
        delivery_details=DeliveryDetailsDTO(**dto.delivery_details.model_dump()) if dto.delivery_details else None,
        items=[OrderItemDTO(**it.model_dump()) for it in dto.items],
        tax_rate=dto.tax_rate,
        additional_charges=dto.additional_charges,
    )
    try:
        po = await use_case.handle(cmd)
        await db.commit()
        return _map_po_to_response(po)
    except PurchaseOrderValidationError as e:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/purchase-orders/draft", response_model=PurchaseOrderResponseSchema, status_code=status.HTTP_201_CREATED)
async def save_draft_purchase_order(
    dto: SaveDraftPurchaseOrderRequestSchema,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = SaveDraftPurchaseOrderUseCase(repo)
    cmd = SaveDraftPurchaseOrderCommand(
        supplier_id=dto.supplier_id,
        warehouse_id=dto.warehouse_id,
        expected_delivery_date=dto.expected_delivery_date,
        po_number=dto.po_number,
        po_date=dto.po_date,
        department=dto.department,
        buyer=dto.buyer,
        payment_terms=dto.payment_terms,
        rfq_id=dto.rfq_id,
        quotation_id=dto.quotation_id,
        supplier_info=SupplierInfoDTO(**dto.supplier_info.model_dump()) if dto.supplier_info else None,
        delivery_details=DeliveryDetailsDTO(**dto.delivery_details.model_dump()) if dto.delivery_details else None,
        items=[OrderItemDTO(**it.model_dump()) for it in dto.items],
        tax_rate=dto.tax_rate,
        additional_charges=dto.additional_charges,
    )
    po = await use_case.handle(cmd)
    await db.commit()
    return _map_po_to_response(po)


@router.get("/purchase-orders", response_model=PurchaseOrderListResponseSchema)
async def list_purchase_orders(
    db: Annotated[AsyncSession, Depends(get_db)],
    status_param: Optional[str] = Query(None, alias="status"),
    supplier_id: Optional[str] = Query(None),
    search_query: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = ListPurchaseOrdersUseCase(repo)
    query = ListPurchaseOrdersQuery(
        status=status_param,
        supplier_id=supplier_id,
        search_query=search_query,
        limit=limit,
        offset=offset,
    )
    orders, total = await use_case.handle(query)
    return PurchaseOrderListResponseSchema(
        items=[_map_po_to_response(po) for po in orders],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/purchase-orders/{id}/pdf")
async def download_purchase_order_pdf(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = GeneratePurchaseOrderPdfUseCase(repo)
    try:
        pdf_bytes = await use_case.handle(id)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=PO-{id}.pdf"},
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/purchase-orders/{id}", response_model=PurchaseOrderResponseSchema)
async def get_purchase_order(id: str, db: Annotated[AsyncSession, Depends(get_db)]):
    repo = SqlAlchemyPurchaseOrderRepository(db)
    use_case = GetPurchaseOrderUseCase(repo)
    try:
        po = await use_case.handle(id)
        return _map_po_to_response(po)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


# --- Section 6: Supplier ASN & Arrival Notifications ---

@router.post("/asns", response_model=ASNResponseSchema, status_code=status.HTTP_201_CREATED)
async def submit_asn(dto: ASNSubmitSchema, db: Annotated[AsyncSession, Depends(get_db)]):
    asn_repo = SqlAlchemyASNRepository(db)
    po_repo = SqlAlchemyPurchaseOrderRepository(db)
    an_repo = SqlAlchemyArrivalNotificationRepository(db)
    use_case = SubmitASNUseCase(asn_repo, po_repo, an_repo)
    cmd = SubmitASNCommand(
        po_id=dto.po_id,
        po_number=dto.po_number,
        supplier_id=dto.supplier_id,
        supplier_name=dto.supplier_name,
        warehouse_id=dto.warehouse_id,
        expected_arrival_date=dto.expected_arrival_date,
        transporter_name=dto.transporter_name,
        tracking_number=dto.tracking_number,
        vehicle_number=dto.vehicle_number,
        items=[
            ASNItemDTO(
                po_item_id=it.po_item_id,
                material_code=it.material_code,
                material_name=it.material_name,
                ordered_qty=it.ordered_qty,
                shipped_qty=it.shipped_qty,
                unit_of_measure=it.unit_of_measure,
                batch_number=it.batch_number,
                expiry_date=it.expiry_date,
            )
            for it in dto.items
        ],
        attachments=[
            ASNAttachmentDTO(
                filename=att.filename,
                file_type=att.file_type,
                file_size_bytes=att.file_size_bytes,
                category=att.category,
                attachment_id=att.id,
                created_at=att.created_at,
            )
            for att in dto.attachments
        ],
        shipped_date=dto.shipped_date,
        driver_name=dto.driver_name,
        driver_phone=dto.driver_phone,
    )
    asn, an = await use_case.execute(cmd)
    await db.commit()
    return ASNResponseSchema(
        id=asn.id,
        asn_number=asn.asn_number,
        po_id=asn.po_id,
        po_number=asn.po_number,
        supplier_id=asn.supplier_id,
        supplier_name=asn.supplier_name,
        warehouse_id=asn.warehouse_id,
        shipped_date=asn.shipped_date,
        expected_arrival_date=asn.expected_arrival_date,
        transporter_name=asn.transporter_name,
        tracking_number=asn.tracking_number,
        vehicle_number=asn.vehicle_number,
        driver_name=asn.driver_name,
        driver_phone=asn.driver_phone,
        status=asn.status.value,
        items=[
            ASNItemSchema(
                po_item_id=it.po_item_id,
                material_code=it.material_code,
                material_name=it.material_name,
                ordered_qty=it.ordered_qty,
                shipped_qty=it.shipped_qty,
                unit_of_measure=it.unit_of_measure,
                batch_number=it.batch_number,
                expiry_date=it.expiry_date,
            )
            for it in asn.items
        ],
        attachments=[
            AttachmentResponseSchema(
                id=str(att.id),
                filename=att.filename,
                file_type=att.file_type,
                file_size_bytes=att.file_size_bytes,
                category=att.category.value,
                created_at=att.created_at,
                download_url=f"/api/v1/procurement/asns/{asn.id}/attachments/{att.id}",
            )
            for att in asn.attachments
        ],
        total_shipped_qty=asn.total_shipped_qty,
        created_at=asn.created_at,
        updated_at=asn.updated_at,
    )


@router.get("/asns", response_model=list[ASNResponseSchema])
async def list_asns(
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = SqlAlchemyASNRepository(db)
    items, total = await repo.list_all(status=status, warehouse_id=warehouse_id, skip=skip, limit=limit)
    return [
        ASNResponseSchema(
            id=asn.id,
            asn_number=asn.asn_number,
            po_id=asn.po_id,
            po_number=asn.po_number,
            supplier_id=asn.supplier_id,
            supplier_name=asn.supplier_name,
            warehouse_id=asn.warehouse_id,
            shipped_date=asn.shipped_date,
            expected_arrival_date=asn.expected_arrival_date,
            transporter_name=asn.transporter_name,
            tracking_number=asn.tracking_number,
            vehicle_number=asn.vehicle_number,
            driver_name=asn.driver_name,
            driver_phone=asn.driver_phone,
            status=asn.status.value,
            items=[
                ASNItemSchema(
                    po_item_id=it.po_item_id,
                    material_code=it.material_code,
                    material_name=it.material_name,
                    ordered_qty=it.ordered_qty,
                    shipped_qty=it.shipped_qty,
                    unit_of_measure=it.unit_of_measure,
                    batch_number=it.batch_number,
                    expiry_date=it.expiry_date,
                )
                for it in asn.items
            ],
            attachments=[
                AttachmentResponseSchema(
                    id=str(att.id),
                    filename=att.filename,
                    file_type=att.file_type,
                    file_size_bytes=att.file_size_bytes,
                    category=att.category.value,
                    created_at=att.created_at,
                    download_url=f"/api/v1/procurement/asns/{asn.id}/attachments/{att.id}",
                )
                for att in asn.attachments
            ],
            total_shipped_qty=asn.total_shipped_qty,
            created_at=asn.created_at,
            updated_at=asn.updated_at,
        )
        for asn in items
    ]


@router.post("/asns/attachments/upload", response_model=AttachmentResponseSchema)
async def upload_asn_attachment(
    file: UploadFile = File(...),
    category: str = Form("SUPPORTING_DOC"),
    db: Annotated[AsyncSession, Depends(get_db)] = None,
):
    storage_dir = "attachments/asns"
    os.makedirs(storage_dir, exist_ok=True)

    att_id = str(uuid.uuid4())
    file_content = await file.read()
    file_path = os.path.join(storage_dir, f"{att_id}_{file.filename}")

    with open(file_path, "wb") as f:
        f.write(file_content)

    # We return a schema that can be used to link to the ASN later
    return AttachmentResponseSchema(
        id=att_id,
        filename=file.filename,
        file_type=file.content_type or "application/octet-stream",
        file_size_bytes=len(file_content),
        category=category,
        created_at=datetime.now(timezone.utc),
        download_url=f"/api/v1/procurement/asns/attachments/temp/{att_id}",
    )


@router.get("/arrival-notifications", response_model=list[ArrivalNotificationResponseSchema])
async def list_arrival_notifications(
    db: Annotated[AsyncSession, Depends(get_db)],
    warehouse_id: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    repo = SqlAlchemyArrivalNotificationRepository(db)
    items, total = await repo.list_all(warehouse_id=warehouse_id, skip=skip, limit=limit)
    return [
        ArrivalNotificationResponseSchema(
            id=an.id,
            asn_id=an.asn_id,
            asn_number=an.asn_number,
            po_id=an.po_id,
            po_number=an.po_number,
            warehouse_id=an.warehouse_id,
            supplier_name=an.supplier_name,
            vehicle_number=an.vehicle_number,
            expected_arrival_time=an.expected_arrival_time,
            driver_phone=an.driver_phone,
            status=an.status.value,
            notified_recipients=an.notified_recipients,
            created_at=an.created_at,
        )
        for an in items
    ]
