"""
SqlAlchemy Persistence implementations for Procurement module.
Converts between aggregates and SQLAlchemy models with Outbox relay support.
"""
from __future__ import annotations

from typing import Optional, Sequence
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.events.outbox_repository import to_outbox_row
from app.modules.procurement.application.repository import (
    ArrivalNotificationRepositoryProtocol,
    ASNRepositoryProtocol,
    FinanceApprovalRepositoryProtocol,
    MaterialRequestRepositoryProtocol,
    PurchaseOrderRepository,
    QuotationRepositoryProtocol,
    RFQRepositoryProtocol,
)
from app.modules.procurement.domain.arrival_notification import ArrivalNotification, ArrivalNotificationStatus
from app.modules.procurement.domain.attachment import PurchaseOrderAttachment
from app.modules.procurement.domain.delivery_details import DeliveryDetails
from app.modules.procurement.domain.finance_approval import FinanceApproval, FinanceApprovalStatus
from app.modules.procurement.domain.material_request import (
    MaterialRequest,
    MaterialRequestItem,
    MaterialRequestStatus,
    PriorityLevel,
)
from app.modules.procurement.domain.purchase_order import PurchaseOrder
from app.modules.procurement.domain.purchase_order_item import PurchaseOrderItem
from app.modules.procurement.domain.purchase_order_status import PurchaseOrderStatus
from app.modules.procurement.domain.rfq import RFQItem, RFQStatus, RFQSupplier, RequestForQuotation
from app.modules.procurement.domain.supplier_asn import ASNItem, ASNStatus, SupplierASN
from app.modules.procurement.domain.supplier_info import SupplierInfo
from app.modules.procurement.domain.supplier_quotation import QuotationItem, QuotationStatus, SupplierQuotation
from app.modules.procurement.domain.value_objects import AttachmentCategory, PurchaseOrderId
from app.modules.procurement.infrastructure.persistence.models import (
    ArrivalNotificationModel,
    ASNItemModel,
    FinanceApprovalModel,
    MaterialRequestItemModel,
    MaterialRequestModel,
    PurchaseOrderAttachmentModel,
    PurchaseOrderItemModel,
    PurchaseOrderModel,
    QuotationItemModel,
    RFQItemModel,
    RFQModel,
    RFQSupplierModel,
    SupplierASNModel,
    SupplierQuotationModel,
)


class SqlAlchemyPurchaseOrderRepository(PurchaseOrderRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    def _to_aggregate(self, model: PurchaseOrderModel) -> PurchaseOrder:
        supp_info = SupplierInfo(
            supplier_code=model.supplier_code,
            supplier_name=model.supplier_name,
            contact_person=model.contact_person,
            phone=model.phone,
            email=model.email,
            gst_number=model.gst_number,
            supplier_address=model.supplier_address,
        )

        deliv_details = DeliveryDetails(
            delivery_warehouse=model.delivery_warehouse,
            delivery_address=model.delivery_address,
            expected_delivery_date=model.delivery_expected_date,
            transporter=model.transporter,
        )

        items = [
            PurchaseOrderItem.create(
                item_id=it.id,
                material_code=it.item_code,
                material_name=it.material_name,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                quantity=it.ordered_quantity,
                unit_price=it.unit_price,
                discount=it.discount,
                tax=it.tax,
            )
            for it in (model.items or [])
        ]

        attachments = [
            PurchaseOrderAttachment(
                id=att.id,
                filename=att.filename,
                file_type=att.file_type,
                file_path=att.file_path,
                file_size_bytes=att.file_size_bytes,
                category=AttachmentCategory(att.category),
                created_at=att.created_at,
            )
            for att in (model.attachments or [])
        ]

        return PurchaseOrder(
            id=PurchaseOrderId.of(model.id),
            po_number=model.po_number,
            po_date=model.po_date,
            status=PurchaseOrderStatus(model.status),
            supplier_id=model.supplier_id,
            warehouse_id=model.warehouse_id,
            department=model.department,
            buyer=model.buyer,
            expected_delivery_date=model.expected_delivery_date,
            payment_terms=model.payment_terms,
            rfq_id=model.rfq_id,
            quotation_id=model.quotation_id,
            finance_approval_id=model.finance_approval_id,
            supplier_info=supp_info,
            delivery_details=deliv_details,
            items=items,
            attachments=attachments,
            tax_rate=model.tax_rate,
            additional_charges=model.additional_charges,
            created_at=model.created_at,
            updated_at=model.updated_at,
        )

    async def save(self, purchase_order: PurchaseOrder) -> None:
        po_uuid = purchase_order.id.value
        model = await self._session.get(PurchaseOrderModel, po_uuid)

        if not model:
            model = PurchaseOrderModel(id=po_uuid)
            self._session.add(model)

        model.po_number = purchase_order.po_number
        model.po_date = purchase_order.po_date
        model.status = purchase_order.status.value
        model.supplier_id = purchase_order.supplier_id
        model.warehouse_id = purchase_order.warehouse_id
        model.department = purchase_order.department
        model.buyer = purchase_order.buyer
        model.expected_delivery_date = purchase_order.expected_delivery_date
        model.payment_terms = purchase_order.payment_terms
        model.rfq_id = purchase_order.rfq_id
        model.quotation_id = purchase_order.quotation_id
        model.finance_approval_id = purchase_order.finance_approval_id

        if purchase_order.supplier_info:
            model.supplier_code = purchase_order.supplier_info.supplier_code
            model.supplier_name = purchase_order.supplier_info.supplier_name
            model.contact_person = purchase_order.supplier_info.contact_person
            model.phone = purchase_order.supplier_info.phone
            model.email = purchase_order.supplier_info.email
            model.gst_number = purchase_order.supplier_info.gst_number
            model.supplier_address = purchase_order.supplier_info.supplier_address

        if purchase_order.delivery_details:
            model.delivery_warehouse = purchase_order.delivery_details.delivery_warehouse
            model.delivery_address = purchase_order.delivery_details.delivery_address
            model.delivery_expected_date = purchase_order.delivery_details.expected_delivery_date
            model.transporter = purchase_order.delivery_details.transporter

        model.tax_rate = purchase_order.tax_rate
        model.additional_charges = purchase_order.additional_charges
        model.updated_at = purchase_order.updated_at

        # Sync items
        model.items.clear()
        for item in purchase_order.items:
            model.items.append(
                PurchaseOrderItemModel(
                    id=item.id,
                    purchase_order_id=po_uuid,
                    item_code=item.material_code,
                    material_name=item.material_name,
                    category=item.category,
                    unit_of_measure=item.unit_of_measure,
                    ordered_quantity=item.quantity,
                    unit_price=item.unit_price,
                    discount=item.discount,
                    tax=item.tax,
                )
            )

        # Sync attachments
        model.attachments.clear()
        for att in purchase_order.attachments:
            model.attachments.append(
                PurchaseOrderAttachmentModel(
                    id=att.id,
                    purchase_order_id=po_uuid,
                    filename=att.filename,
                    file_type=att.file_type,
                    file_path=att.file_path,
                    file_size_bytes=att.file_size_bytes,
                    category=att.category.value,
                    created_at=att.created_at,
                )
            )

        # Write outbox domain events
        for event in purchase_order.recorded_events:
            self._session.add(to_outbox_row("PurchaseOrder", str(po_uuid), event))
        purchase_order.recorded_events.clear()

        await self._session.flush()

    async def find_by_id(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrderModel)
            .options(
                selectinload(PurchaseOrderModel.items),
                selectinload(PurchaseOrderModel.attachments),
            )
            .where(PurchaseOrderModel.id == po_id.value)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_aggregate(model) if model else None

    async def find_by_po_number(self, po_number: str) -> Optional[PurchaseOrder]:
        stmt = (
            select(PurchaseOrderModel)
            .options(
                selectinload(PurchaseOrderModel.items),
                selectinload(PurchaseOrderModel.attachments),
            )
            .where(PurchaseOrderModel.po_number == po_number)
        )
        result = await self._session.execute(stmt)
        model = result.scalar_one_or_none()
        return self._to_aggregate(model) if model else None

    async def list_all(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[PurchaseOrder]:
        stmt = select(PurchaseOrderModel).options(
            selectinload(PurchaseOrderModel.items),
            selectinload(PurchaseOrderModel.attachments),
        )

        if status:
            stmt = stmt.where(PurchaseOrderModel.status == status)
        if supplier_id:
            stmt = stmt.where(PurchaseOrderModel.supplier_id == supplier_id)
        if search_query:
            term = f"%{search_query}%"
            stmt = stmt.where(
                or_(
                    PurchaseOrderModel.po_number.ilike(term),
                    PurchaseOrderModel.supplier_name.ilike(term),
                )
            )

        stmt = stmt.order_by(PurchaseOrderModel.created_at.desc()).offset(offset).limit(limit)
        result = await self._session.execute(stmt)
        models = result.scalars().all()
        return [self._to_aggregate(m) for m in models]

    async def count(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> int:
        stmt = select(func.count(PurchaseOrderModel.id))

        if status:
            stmt = stmt.where(PurchaseOrderModel.status == status)
        if supplier_id:
            stmt = stmt.where(PurchaseOrderModel.supplier_id == supplier_id)
        if search_query:
            term = f"%{search_query}%"
            stmt = stmt.where(
                or_(
                    PurchaseOrderModel.po_number.ilike(term),
                    PurchaseOrderModel.supplier_name.ilike(term),
                )
            )

        result = await self._session.execute(stmt)
        return result.scalar() or 0


# --- Pipeline Stage Repositories ---

class SqlAlchemyMaterialRequestRepository(MaterialRequestRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, request: MaterialRequest) -> MaterialRequest:
        model = await self._session.get(MaterialRequestModel, request.id)
        if not model:
            model = MaterialRequestModel(id=request.id)
            self._session.add(model)

        model.request_number = request.request_number
        model.warehouse_id = request.warehouse_id
        model.department = request.department
        model.requested_by = request.requested_by
        model.target_delivery_date = request.target_delivery_date
        model.priority = request.priority.value if isinstance(request.priority, PriorityLevel) else str(request.priority)
        model.status = request.status.value if isinstance(request.status, MaterialRequestStatus) else str(request.status)
        model.rejection_reason = request.rejection_reason
        model.updated_at = request.updated_at

        model.items.clear()
        for item in request.items:
            model.items.append(
                MaterialRequestItemModel(
                    id=item.id,
                    material_request_id=request.id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    category=item.category,
                    unit_of_measure=item.unit_of_measure,
                    requested_qty=item.requested_qty,
                    estimated_unit_cost=item.estimated_unit_cost,
                    notes=item.notes,
                )
            )

        for event in request.recorded_events:
            self._session.add(to_outbox_row("MaterialRequest", request.id, event))
        request.recorded_events.clear()

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, request_id: str) -> Optional[MaterialRequest]:
        model = await self._session.get(MaterialRequestModel, request_id)
        return self._to_domain(model) if model else None

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[MaterialRequest], int]:
        stmt = select(MaterialRequestModel)
        count_stmt = select(func.count(MaterialRequestModel.id))

        if status:
            stmt = stmt.where(MaterialRequestModel.status == status)
            count_stmt = count_stmt.where(MaterialRequestModel.status == status)
        if warehouse_id:
            stmt = stmt.where(MaterialRequestModel.warehouse_id == warehouse_id)
            count_stmt = count_stmt.where(MaterialRequestModel.warehouse_id == warehouse_id)

        stmt = stmt.order_by(MaterialRequestModel.created_at.desc()).offset(skip).limit(limit)
        total = (await self._session.execute(count_stmt)).scalar() or 0
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models], total

    def _to_domain(self, m: MaterialRequestModel) -> MaterialRequest:
        items = [
            MaterialRequestItem(
                id=it.id,
                material_code=it.material_code,
                material_name=it.material_name,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                requested_qty=it.requested_qty,
                estimated_unit_cost=it.estimated_unit_cost,
                notes=it.notes,
            )
            for it in (m.items or [])
        ]
        return MaterialRequest(
            id=m.id,
            request_number=m.request_number,
            warehouse_id=m.warehouse_id,
            department=m.department,
            requested_by=m.requested_by,
            target_delivery_date=m.target_delivery_date,
            priority=PriorityLevel(m.priority),
            status=MaterialRequestStatus(m.status),
            rejection_reason=m.rejection_reason,
            items=items,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


class SqlAlchemyRFQRepository(RFQRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, rfq: RequestForQuotation) -> RequestForQuotation:
        model = await self._session.get(RFQModel, rfq.id)
        if not model:
            model = RFQModel(id=rfq.id)
            self._session.add(model)

        model.rfq_number = rfq.rfq_number
        model.title = rfq.title
        model.warehouse_id = rfq.warehouse_id
        model.issue_date = rfq.issue_date
        model.due_date = rfq.due_date
        model.status = rfq.status.value if isinstance(rfq.status, RFQStatus) else str(rfq.status)
        model.material_request_ids = ",".join(rfq.material_request_ids) if rfq.material_request_ids else None
        model.terms_and_conditions = rfq.terms_and_conditions
        model.updated_at = rfq.updated_at

        model.items.clear()
        for item in rfq.items:
            model.items.append(
                RFQItemModel(
                    id=item.id,
                    rfq_id=rfq.id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    quantity=item.quantity,
                    unit_of_measure=item.unit_of_measure,
                )
            )

        model.invited_suppliers.clear()
        for s in rfq.invited_suppliers:
            model.invited_suppliers.append(
                RFQSupplierModel(
                    rfq_id=rfq.id,
                    supplier_id=s.supplier_id,
                    supplier_code=s.supplier_code,
                    supplier_name=s.supplier_name,
                    email=s.email,
                    status=s.status,
                )
            )

        for event in rfq.recorded_events:
            self._session.add(to_outbox_row("RFQ", rfq.id, event))
        rfq.recorded_events.clear()

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, rfq_id: str) -> Optional[RequestForQuotation]:
        model = await self._session.get(RFQModel, rfq_id)
        return self._to_domain(model) if model else None

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[RequestForQuotation], int]:
        stmt = select(RFQModel)
        count_stmt = select(func.count(RFQModel.id))

        if status:
            stmt = stmt.where(RFQModel.status == status)
            count_stmt = count_stmt.where(RFQModel.status == status)
        if warehouse_id:
            stmt = stmt.where(RFQModel.warehouse_id == warehouse_id)
            count_stmt = count_stmt.where(RFQModel.warehouse_id == warehouse_id)

        stmt = stmt.order_by(RFQModel.created_at.desc()).offset(skip).limit(limit)
        total = (await self._session.execute(count_stmt)).scalar() or 0
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models], total

    def _to_domain(self, m: RFQModel) -> RequestForQuotation:
        items = [
            RFQItem(
                id=it.id,
                material_code=it.material_code,
                material_name=it.material_name,
                quantity=it.quantity,
                unit_of_measure=it.unit_of_measure,
            )
            for it in (m.items or [])
        ]
        suppliers = [
            RFQSupplier(
                supplier_id=s.supplier_id,
                supplier_code=s.supplier_code,
                supplier_name=s.supplier_name,
                email=s.email,
                status=s.status,
            )
            for s in (m.invited_suppliers or [])
        ]
        mr_ids = [x.strip() for x in m.material_request_ids.split(",")] if m.material_request_ids else []
        return RequestForQuotation(
            id=m.id,
            rfq_number=m.rfq_number,
            title=m.title,
            warehouse_id=m.warehouse_id,
            issue_date=m.issue_date,
            due_date=m.due_date,
            status=RFQStatus(m.status),
            material_request_ids=mr_ids,
            terms_and_conditions=m.terms_and_conditions,
            items=items,
            invited_suppliers=suppliers,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


class SqlAlchemyQuotationRepository(QuotationRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, quotation: SupplierQuotation) -> SupplierQuotation:
        model = await self._session.get(SupplierQuotationModel, quotation.id)
        if not model:
            model = SupplierQuotationModel(id=quotation.id)
            self._session.add(model)

        model.quotation_number = quotation.quotation_number
        model.rfq_id = quotation.rfq_id
        model.supplier_id = quotation.supplier_id
        model.supplier_code = quotation.supplier_code
        model.supplier_name = quotation.supplier_name
        model.submission_date = quotation.submission_date
        model.valid_until = quotation.valid_until
        model.payment_terms = quotation.payment_terms
        model.delivery_lead_time_days = quotation.delivery_lead_time_days
        model.status = quotation.status.value if isinstance(quotation.status, QuotationStatus) else str(quotation.status)
        model.rejection_reason = quotation.rejection_reason
        model.updated_at = quotation.updated_at

        model.items.clear()
        for item in quotation.items:
            model.items.append(
                QuotationItemModel(
                    id=item.id,
                    quotation_id=quotation.id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    offered_qty=item.offered_qty,
                    unit_price=item.unit_price,
                    tax_rate=item.tax_rate,
                    discount_percent=item.discount_percent,
                )
            )

        for event in quotation.recorded_events:
            self._session.add(to_outbox_row("SupplierQuotation", quotation.id, event))
        quotation.recorded_events.clear()

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, quotation_id: str) -> Optional[SupplierQuotation]:
        model = await self._session.get(SupplierQuotationModel, quotation_id)
        return self._to_domain(model) if model else None

    async def list_by_rfq(self, rfq_id: str) -> list[SupplierQuotation]:
        stmt = select(SupplierQuotationModel).where(SupplierQuotationModel.rfq_id == rfq_id)
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models]

    def _to_domain(self, m: SupplierQuotationModel) -> SupplierQuotation:
        items = [
            QuotationItem(
                id=it.id,
                material_code=it.material_code,
                material_name=it.material_name,
                offered_qty=it.offered_qty,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate,
                discount_percent=it.discount_percent,
            )
            for it in (m.items or [])
        ]
        return SupplierQuotation(
            id=m.id,
            quotation_number=m.quotation_number,
            rfq_id=m.rfq_id,
            supplier_id=m.supplier_id,
            supplier_code=m.supplier_code,
            supplier_name=m.supplier_name,
            submission_date=m.submission_date,
            valid_until=m.valid_until,
            payment_terms=m.payment_terms,
            delivery_lead_time_days=m.delivery_lead_time_days,
            status=QuotationStatus(m.status),
            rejection_reason=m.rejection_reason,
            items=items,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


class SqlAlchemyFinanceApprovalRepository(FinanceApprovalRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, approval: FinanceApproval) -> FinanceApproval:
        model = await self._session.get(FinanceApprovalModel, approval.id)
        if not model:
            model = FinanceApprovalModel(id=approval.id)
            self._session.add(model)

        model.po_id = approval.po_id
        model.po_number = approval.po_number
        model.total_amount = approval.total_amount
        model.requested_by = approval.requested_by
        model.budget_code = approval.budget_code
        model.currency = approval.currency
        model.status = approval.status.value if isinstance(approval.status, FinanceApprovalStatus) else str(approval.status)
        model.approver_id = approval.approver_id
        model.approver_name = approval.approver_name
        model.approval_notes = approval.approval_notes
        model.rejection_reason = approval.rejection_reason
        model.updated_at = approval.updated_at

        for event in approval.recorded_events:
            self._session.add(to_outbox_row("FinanceApproval", approval.id, event))
        approval.recorded_events.clear()

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, approval_id: str) -> Optional[FinanceApproval]:
        model = await self._session.get(FinanceApprovalModel, approval_id)
        return self._to_domain(model) if model else None

    async def get_by_po_id(self, po_id: str) -> Optional[FinanceApproval]:
        stmt = select(FinanceApprovalModel).where(FinanceApprovalModel.po_id == po_id)
        model = (await self._session.execute(stmt)).scalar_one_or_none()
        return self._to_domain(model) if model else None

    async def list_all(
        self,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[FinanceApproval], int]:
        stmt = select(FinanceApprovalModel)
        count_stmt = select(func.count(FinanceApprovalModel.id))

        if status:
            stmt = stmt.where(FinanceApprovalModel.status == status)
            count_stmt = count_stmt.where(FinanceApprovalModel.status == status)

        stmt = stmt.order_by(FinanceApprovalModel.created_at.desc()).offset(skip).limit(limit)
        total = (await self._session.execute(count_stmt)).scalar() or 0
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models], total

    def _to_domain(self, m: FinanceApprovalModel) -> FinanceApproval:
        return FinanceApproval(
            id=m.id,
            po_id=m.po_id,
            po_number=m.po_number,
            total_amount=m.total_amount,
            requested_by=m.requested_by,
            budget_code=m.budget_code,
            currency=m.currency,
            status=FinanceApprovalStatus(m.status),
            approver_id=m.approver_id,
            approver_name=m.approver_name,
            approval_notes=m.approval_notes,
            rejection_reason=m.rejection_reason,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


class SqlAlchemyASNRepository(ASNRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, asn: SupplierASN) -> SupplierASN:
        model = await self._session.get(SupplierASNModel, asn.id)
        if not model:
            model = SupplierASNModel(id=asn.id)
            self._session.add(model)

        model.asn_number = asn.asn_number
        model.po_id = asn.po_id
        model.po_number = asn.po_number
        model.supplier_id = asn.supplier_id
        model.supplier_name = asn.supplier_name
        model.warehouse_id = asn.warehouse_id
        model.shipped_date = asn.shipped_date
        model.expected_arrival_date = asn.expected_arrival_date
        model.transporter_name = asn.transporter_name
        model.tracking_number = asn.tracking_number
        model.vehicle_number = asn.vehicle_number
        model.driver_name = asn.driver_name
        model.driver_phone = asn.driver_phone
        model.status = asn.status.value if isinstance(asn.status, ASNStatus) else str(asn.status)
        model.updated_at = asn.updated_at

        model.items.clear()
        for item in asn.items:
            model.items.append(
                ASNItemModel(
                    id=item.id,
                    asn_id=asn.id,
                    po_item_id=item.po_item_id,
                    material_code=item.material_code,
                    material_name=item.material_name,
                    ordered_qty=item.ordered_qty,
                    shipped_qty=item.shipped_qty,
                    unit_of_measure=item.unit_of_measure,
                    batch_number=item.batch_number,
                    expiry_date=item.expiry_date,
                )
            )

        for event in asn.recorded_events:
            self._session.add(to_outbox_row("SupplierASN", asn.id, event))
        asn.recorded_events.clear()

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, asn_id: str) -> Optional[SupplierASN]:
        model = await self._session.get(SupplierASNModel, asn_id)
        return self._to_domain(model) if model else None

    async def get_by_vehicle(self, vehicle_number: str) -> Optional[SupplierASN]:
        stmt = select(SupplierASNModel).where(SupplierASNModel.vehicle_number == vehicle_number.strip().upper()).order_by(SupplierASNModel.created_at.desc())
        model = (await self._session.execute(stmt)).scalars().first()
        return self._to_domain(model) if model else None

    async def get_by_po_id(self, po_id: str) -> Optional[SupplierASN]:
        stmt = select(SupplierASNModel).where(SupplierASNModel.po_id == po_id).order_by(SupplierASNModel.created_at.desc())
        model = (await self._session.execute(stmt)).scalars().first()
        return self._to_domain(model) if model else None

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SupplierASN], int]:
        stmt = select(SupplierASNModel)
        count_stmt = select(func.count(SupplierASNModel.id))

        if status:
            stmt = stmt.where(SupplierASNModel.status == status)
            count_stmt = count_stmt.where(SupplierASNModel.status == status)
        if warehouse_id:
            stmt = stmt.where(SupplierASNModel.warehouse_id == warehouse_id)
            count_stmt = count_stmt.where(SupplierASNModel.warehouse_id == warehouse_id)

        stmt = stmt.order_by(SupplierASNModel.created_at.desc()).offset(skip).limit(limit)
        total = (await self._session.execute(count_stmt)).scalar() or 0
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models], total

    def _to_domain(self, m: SupplierASNModel) -> SupplierASN:
        items = [
            ASNItem(
                id=it.id,
                po_item_id=it.po_item_id,
                material_code=it.material_code,
                material_name=it.material_name,
                ordered_qty=it.ordered_qty,
                shipped_qty=it.shipped_qty,
                unit_of_measure=it.unit_of_measure,
                batch_number=it.batch_number,
                expiry_date=it.expiry_date,
            )
            for it in (m.items or [])
        ]
        return SupplierASN(
            id=m.id,
            asn_number=m.asn_number,
            po_id=m.po_id,
            po_number=m.po_number,
            supplier_id=m.supplier_id,
            supplier_name=m.supplier_name,
            warehouse_id=m.warehouse_id,
            shipped_date=m.shipped_date,
            expected_arrival_date=m.expected_arrival_date,
            transporter_name=m.transporter_name,
            tracking_number=m.tracking_number,
            vehicle_number=m.vehicle_number,
            driver_name=m.driver_name,
            driver_phone=m.driver_phone,
            status=ASNStatus(m.status),
            items=items,
            created_at=m.created_at,
            updated_at=m.updated_at,
        )


class SqlAlchemyArrivalNotificationRepository(ArrivalNotificationRepositoryProtocol):
    def __init__(self, session: AsyncSession):
        self._session = session

    async def save(self, notification: ArrivalNotification) -> ArrivalNotification:
        model = await self._session.get(ArrivalNotificationModel, notification.id)
        if not model:
            model = ArrivalNotificationModel(id=notification.id)
            self._session.add(model)

        model.asn_id = notification.asn_id
        model.asn_number = notification.asn_number
        model.po_id = notification.po_id
        model.po_number = notification.po_number
        model.warehouse_id = notification.warehouse_id
        model.supplier_name = notification.supplier_name
        model.vehicle_number = notification.vehicle_number
        model.expected_arrival_time = notification.expected_arrival_time
        model.driver_phone = notification.driver_phone
        model.status = notification.status.value if isinstance(notification.status, ArrivalNotificationStatus) else str(notification.status)
        model.updated_at = notification.updated_at

        await self._session.flush()
        return self._to_domain(model)

    async def get_by_id(self, notification_id: str) -> Optional[ArrivalNotification]:
        model = await self._session.get(ArrivalNotificationModel, notification_id)
        return self._to_domain(model) if model else None

    async def list_all(
        self,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ArrivalNotification], int]:
        stmt = select(ArrivalNotificationModel)
        count_stmt = select(func.count(ArrivalNotificationModel.id))

        if warehouse_id:
            stmt = stmt.where(ArrivalNotificationModel.warehouse_id == warehouse_id)
            count_stmt = count_stmt.where(ArrivalNotificationModel.warehouse_id == warehouse_id)

        stmt = stmt.order_by(ArrivalNotificationModel.created_at.desc()).offset(skip).limit(limit)
        total = (await self._session.execute(count_stmt)).scalar() or 0
        models = (await self._session.execute(stmt)).scalars().all()
        return [self._to_domain(m) for m in models], total

    def _to_domain(self, m: ArrivalNotificationModel) -> ArrivalNotification:
        return ArrivalNotification(
            id=m.id,
            asn_id=m.asn_id,
            asn_number=m.asn_number,
            po_id=m.po_id,
            po_number=m.po_number,
            warehouse_id=m.warehouse_id,
            supplier_name=m.supplier_name,
            vehicle_number=m.vehicle_number,
            expected_arrival_time=m.expected_arrival_time,
            driver_phone=m.driver_phone,
            status=ArrivalNotificationStatus(m.status),
            created_at=m.created_at,
            updated_at=m.updated_at,
        )
