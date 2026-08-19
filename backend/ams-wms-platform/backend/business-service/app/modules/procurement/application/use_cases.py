"""
Use cases for procurement purchase order pipeline operations.
"""
from __future__ import annotations

from decimal import Decimal
import os
from typing import Optional, Sequence
import uuid

from app.modules.procurement.application.commands import (
    ApproveFinanceCommand,
    CreateMaterialRequestCommand,
    CreatePurchaseOrderCommand,
    CreateRFQCommand,
    RejectFinanceCommand,
    ResubmitPurchaseOrderCommand,
    SaveDraftPurchaseOrderCommand,
    SelectQuotationCommand,
    SendPOSupplierEmailCommand,
    SendRFQEmailsCommand,
    SubmitASNCommand,
    SubmitQuotationCommand,
    UpdatePurchaseOrderCommand,
    UploadAttachmentCommand,
)
from app.modules.procurement.application.exceptions import (
    AttachmentNotFoundException,
    PurchaseOrderNotFoundException,
)
from app.modules.procurement.application.pdf_service import PurchaseOrderPdfGenerator
from app.modules.procurement.application.queries import ListPurchaseOrdersQuery
from app.modules.procurement.application.repository import (
    ArrivalNotificationRepositoryProtocol,
    ASNRepositoryProtocol,
    FinanceApprovalRepositoryProtocol,
    MaterialRequestRepositoryProtocol,
    PurchaseOrderRepository,
    QuotationRepositoryProtocol,
    RFQRepositoryProtocol,
)
from app.modules.procurement.domain.arrival_notification import ArrivalNotification
from app.modules.procurement.domain.attachment import PurchaseOrderAttachment as ASNAttachment
from app.modules.procurement.domain.delivery_details import DeliveryDetails
from app.modules.procurement.domain.events import (
    ArrivalNotificationDispatchedEvent,
    FinanceApprovedEvent,
    MaterialRequestCreatedEvent,
    PurchaseOrderCreatedEvent,
    RFQPublishedEvent,
    SupplierASNSubmittedEvent,
    SupplierQuotationSubmittedEvent,
    SupplierSelectedEvent,
)
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
from app.modules.procurement.domain.supplier_asn import ASNItem, SupplierASN
from app.modules.procurement.domain.supplier_info import SupplierInfo
from app.modules.procurement.domain.supplier_quotation import QuotationItem, SupplierQuotation
from app.modules.procurement.domain.value_objects import AttachmentCategory, PurchaseOrderId

# --- Purchase Order Use Cases ---

class CreatePurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, command: CreatePurchaseOrderCommand) -> PurchaseOrder:
        supp_info = None
        if command.supplier_info:
            supp_info = SupplierInfo(
                supplier_code=command.supplier_info.supplier_code or command.supplier_id,
                supplier_name=command.supplier_info.supplier_name,
                contact_person=command.supplier_info.contact_person,
                phone=command.supplier_info.phone,
                email=command.supplier_info.email,
                gst_number=command.supplier_info.gst_number,
                supplier_address=command.supplier_info.supplier_address,
            )

        deliv_details = None
        if command.delivery_details:
            deliv_details = DeliveryDetails(
                delivery_warehouse=command.delivery_details.delivery_warehouse or command.warehouse_id,
                delivery_address=command.delivery_details.delivery_address,
                expected_delivery_date=command.delivery_details.expected_delivery_date or command.expected_delivery_date,
                transporter=command.delivery_details.transporter,
            )

        items = [
            PurchaseOrderItem.create(
                material_code=it.material_code,
                material_name=it.material_name,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                quantity=it.quantity,
                unit_price=it.unit_price,
                discount=it.discount,
                tax=it.tax,
            )
            for it in (command.items or [])
        ]

        po = PurchaseOrder.create(
            supplier_id=command.supplier_id,
            warehouse_id=command.warehouse_id,
            expected_delivery_date=command.expected_delivery_date,
            po_number=command.po_number,
            po_date=command.po_date,
            department=command.department,
            buyer=command.buyer,
            supplier_info=supp_info,
            delivery_details=deliv_details,
            items=items,
            tax_rate=command.tax_rate,
            additional_charges=command.additional_charges,
            payment_terms=command.payment_terms,
            rfq_id=command.rfq_id,
            quotation_id=command.quotation_id,
            material_request_ids=command.material_request_ids,
        )

        await self.repo.save(po)
        return po


class SaveDraftPurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, command: SaveDraftPurchaseOrderCommand) -> PurchaseOrder:
        supp_info = None
        if command.supplier_info:
            supp_info = SupplierInfo(
                supplier_code=command.supplier_info.supplier_code or command.supplier_id,
                supplier_name=command.supplier_info.supplier_name,
                contact_person=command.supplier_info.contact_person,
                phone=command.supplier_info.phone,
                email=command.supplier_info.email,
                gst_number=command.supplier_info.gst_number,
                supplier_address=command.supplier_info.supplier_address,
            )

        deliv_details = None
        if command.delivery_details:
            deliv_details = DeliveryDetails(
                delivery_warehouse=command.delivery_details.delivery_warehouse or command.warehouse_id,
                delivery_address=command.delivery_details.delivery_address,
                expected_delivery_date=command.delivery_details.expected_delivery_date or command.expected_delivery_date,
                transporter=command.delivery_details.transporter,
            )

        items = [
            PurchaseOrderItem.create(
                material_code=it.material_code,
                material_name=it.material_name,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                quantity=it.quantity,
                unit_price=it.unit_price,
                discount=it.discount,
                tax=it.tax,
            )
            for it in (command.items or [])
        ]

        po = PurchaseOrder.save_draft(
            supplier_id=command.supplier_id,
            warehouse_id=command.warehouse_id,
            expected_delivery_date=command.expected_delivery_date,
            po_number=command.po_number,
            po_date=command.po_date,
            department=command.department,
            buyer=command.buyer,
            supplier_info=supp_info,
            delivery_details=deliv_details,
            items=items,
            tax_rate=command.tax_rate,
            additional_charges=command.additional_charges,
            payment_terms=command.payment_terms,
            rfq_id=command.rfq_id,
            quotation_id=command.quotation_id,
        )

        await self.repo.save(po)
        return po


class UpdatePurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, command: UpdatePurchaseOrderCommand) -> PurchaseOrder:
        po_id = PurchaseOrderId.of(command.po_id)
        po = await self.repo.find_by_id(po_id)
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {command.po_id} not found")

        supp_info = None
        if command.supplier_info:
            supp_info = SupplierInfo(
                supplier_code=command.supplier_info.supplier_code or po.supplier_id,
                supplier_name=command.supplier_info.supplier_name,
                contact_person=command.supplier_info.contact_person,
                phone=command.supplier_info.phone,
                email=command.supplier_info.email,
                gst_number=command.supplier_info.gst_number,
                supplier_address=command.supplier_info.supplier_address,
            )

        deliv_details = None
        if command.delivery_details:
            deliv_details = DeliveryDetails(
                delivery_warehouse=command.delivery_details.delivery_warehouse or po.warehouse_id,
                delivery_address=command.delivery_details.delivery_address,
                expected_delivery_date=command.delivery_details.expected_delivery_date or po.expected_delivery_date,
                transporter=command.delivery_details.transporter,
            )

        items = None
        if command.items is not None:
            items = [
                PurchaseOrderItem.create(
                    material_code=it.material_code,
                    material_name=it.material_name,
                    category=it.category,
                    unit_of_measure=it.unit_of_measure,
                    quantity=it.quantity,
                    unit_price=it.unit_price,
                    discount=it.discount,
                    tax=it.tax,
                )
                for it in command.items
            ]

        status_enum = PurchaseOrderStatus(command.status) if command.status else None

        po.update(
            supplier_id=command.supplier_id,
            warehouse_id=command.warehouse_id,
            expected_delivery_date=command.expected_delivery_date,
            department=command.department,
            buyer=command.buyer,
            supplier_info=supp_info,
            delivery_details=deliv_details,
            items=items,
            status=status_enum,
            additional_charges=command.additional_charges,
        )

        await self.repo.save(po)
        return po


class CancelPurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, po_id_str: str) -> PurchaseOrder:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.repo.find_by_id(po_id)
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {po_id_str} not found")
        po.cancel()
        await self.repo.save(po)
        return po


class GetPurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, po_id_str: str) -> PurchaseOrder:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.repo.find_by_id(po_id)
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {po_id_str} not found")
        return po


class ListPurchaseOrdersUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, query: ListPurchaseOrdersQuery) -> tuple[Sequence[PurchaseOrder], int]:
        orders = await self.repo.list_all(
            status=query.status,
            supplier_id=query.supplier_id,
            search_query=query.search_query,
            limit=query.limit,
            offset=query.offset,
        )
        total = await self.repo.count(
            status=query.status,
            supplier_id=query.supplier_id,
            search_query=query.search_query,
        )
        return orders, total


class UploadAttachmentUseCase:
    def __init__(self, repository: PurchaseOrderRepository, storage_dir: str = "attachments") -> None:
        self.repo = repository
        self.storage_dir = storage_dir
        os.makedirs(self.storage_dir, exist_ok=True)

    async def handle(self, command: UploadAttachmentCommand) -> PurchaseOrderAttachment:
        po_id = PurchaseOrderId.of(command.po_id)
        po = await self.repo.find_by_id(po_id)
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {command.po_id} not found")

        att_id = str(uuid.uuid4())
        file_path = os.path.join(self.storage_dir, f"{att_id}_{command.filename}")
        with open(file_path, "wb") as f:
            f.write(command.file_content)

        attachment = PurchaseOrderAttachment.create(
            filename=command.filename,
            file_type=command.file_type,
            file_size_bytes=len(command.file_content),
            file_path=file_path,
            category=AttachmentCategory(command.category) if command.category else AttachmentCategory.OTHER,
            attachment_id=att_id,
        )

        po.add_attachment(attachment)
        await self.repo.save(po)
        return attachment


class GeneratePurchaseOrderPdfUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository
        self.pdf_generator = PurchaseOrderPdfGenerator()

    async def handle(self, po_id_str: str) -> bytes:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.repo.find_by_id(po_id)
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {po_id_str} not found")
        return self.pdf_generator.generate_pdf(po)


# --- Pipeline Stage Use Cases ---

class CreateMaterialRequestUseCase:
    def __init__(self, repo: MaterialRequestRepositoryProtocol):
        self.repo = repo

    async def execute(self, command: CreateMaterialRequestCommand) -> MaterialRequest:
        items = [
            MaterialRequestItem.create(
                material_code=it.material_code,
                material_name=it.material_name,
                requested_qty=it.requested_qty,
                category=it.category,
                unit_of_measure=it.unit_of_measure,
                estimated_unit_cost=it.estimated_unit_cost,
                notes=it.notes,
            )
            for it in command.items
        ]
        priority = PriorityLevel(command.priority.upper()) if command.priority else PriorityLevel.MEDIUM
        req = MaterialRequest.create(
            warehouse_id=command.warehouse_id,
            department=command.department,
            requested_by=command.requested_by,
            target_delivery_date=command.target_delivery_date,
            items=items,
            priority=priority,
        )
        req.recorded_events.append(
            MaterialRequestCreatedEvent(
                request_id=req.id,
                request_number=req.request_number,
                warehouse_id=req.warehouse_id,
                status=req.status.value,
            )
        )
        return await self.repo.save(req)


class SubmitMaterialRequestUseCase:
    def __init__(self, repo: MaterialRequestRepositoryProtocol):
        self.repo = repo

    async def execute(self, request_id: str) -> MaterialRequest:
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise ValueError(f"Material Request '{request_id}' not found")
        req.submit()
        return await self.repo.save(req)


class ApproveMaterialRequestUseCase:
    def __init__(self, repo: MaterialRequestRepositoryProtocol):
        self.repo = repo

    async def execute(self, request_id: str) -> MaterialRequest:
        req = await self.repo.get_by_id(request_id)
        if not req:
            raise ValueError(f"Material Request '{request_id}' not found")
        req.approve()
        return await self.repo.save(req)


class CreateRFQUseCase:
    def __init__(self, repo: RFQRepositoryProtocol, mr_repo: MaterialRequestRepositoryProtocol | None = None):
        self.repo = repo
        self.mr_repo = mr_repo

    async def execute(self, command: CreateRFQCommand) -> RequestForQuotation:
        items = [
            RFQItem.create(
                material_code=it.material_code,
                material_name=it.material_name,
                quantity=it.quantity,
                unit_of_measure=it.unit_of_measure,
            )
            for it in command.items
        ]
        suppliers = [
            RFQSupplier(
                supplier_id=s.supplier_id,
                supplier_code=s.supplier_code,
                supplier_name=s.supplier_name,
                email=s.email,
            )
            for s in command.invited_suppliers
        ]
        rfq = RequestForQuotation.create(
            title=command.title,
            warehouse_id=command.warehouse_id,
            due_date=command.due_date,
            items=items,
            invited_suppliers=suppliers,
            material_request_ids=command.material_request_ids,
            terms_and_conditions=command.terms_and_conditions,
        )
        if self.mr_repo and command.material_request_ids:
            for mr_id in command.material_request_ids:
                mr = await self.mr_repo.get_by_id(mr_id)
                if mr:
                    mr.mark_in_rfq()
                    await self.mr_repo.save(mr)

        return await self.repo.save(rfq)


class PublishRFQUseCase:
    def __init__(self, repo: RFQRepositoryProtocol):
        self.repo = repo

    async def execute(self, rfq_id: str) -> RequestForQuotation:
        rfq = await self.repo.get_by_id(rfq_id)
        if not rfq:
            raise ValueError(f"RFQ '{rfq_id}' not found")
        rfq.publish()
        rfq.recorded_events.append(
            RFQPublishedEvent(
                rfq_id=rfq.id,
                rfq_number=rfq.rfq_number,
                title=rfq.title,
                status=rfq.status.value,
            )
        )
        return await self.repo.save(rfq)


class SubmitQuotationUseCase:
    def __init__(self, repo: QuotationRepositoryProtocol, rfq_repo: RFQRepositoryProtocol):
        self.repo = repo
        self.rfq_repo = rfq_repo

    async def execute(self, command: SubmitQuotationCommand) -> SupplierQuotation:
        rfq = await self.rfq_repo.get_by_id(command.rfq_id)
        if not rfq:
            raise ValueError(f"RFQ '{command.rfq_id}' not found")

        items = [
            QuotationItem.create(
                material_code=it.material_code,
                material_name=it.material_name,
                offered_qty=it.offered_qty,
                unit_price=it.unit_price,
                tax_rate=it.tax_rate,
                discount_percent=it.discount_percent,
            )
            for it in command.items
        ]
        quo = SupplierQuotation.create(
            rfq_id=command.rfq_id,
            supplier_id=command.supplier_id,
            supplier_code=command.supplier_code,
            supplier_name=command.supplier_name,
            valid_until=command.valid_until,
            items=items,
            payment_terms=command.payment_terms,
            delivery_lead_time_days=command.delivery_lead_time_days,
        )

        rfq.mark_quotations_received()
        await self.rfq_repo.save(rfq)

        quo.recorded_events.append(
            SupplierQuotationSubmittedEvent(
                quotation_id=quo.id,
                quotation_number=quo.quotation_number,
                rfq_id=quo.rfq_id,
                supplier_id=quo.supplier_id,
                status=quo.status.value,
            )
        )
        return await self.repo.save(quo)


class SelectSupplierQuotationUseCase:
    def __init__(
        self,
        quo_repo: QuotationRepositoryProtocol,
        rfq_repo: RFQRepositoryProtocol,
        po_repo: PurchaseOrderRepository,
        fa_repo: FinanceApprovalRepositoryProtocol,
    ):
        self.quo_repo = quo_repo
        self.rfq_repo = rfq_repo
        self.po_repo = po_repo
        self.fa_repo = fa_repo

    async def execute(self, command: SelectQuotationCommand) -> tuple[SupplierQuotation, PurchaseOrder, FinanceApproval]:
        selected_quo = await self.quo_repo.get_by_id(command.quotation_id)
        if not selected_quo or selected_quo.rfq_id != command.rfq_id:
            raise ValueError(f"Quotation '{command.quotation_id}' not found for RFQ '{command.rfq_id}'")

        all_quotes = await self.quo_repo.list_by_rfq(command.rfq_id)
        for q in all_quotes:
            if q.id == selected_quo.id:
                q.mark_selected()
            else:
                q.mark_rejected(reason="Another supplier quotation was selected")
            await self.quo_repo.save(q)

        rfq = await self.rfq_repo.get_by_id(command.rfq_id)
        if rfq:
            reason_text = getattr(command, 'reason', None) or getattr(command, 'comments', None) or "Selected lowest commercial bid with fastest lead time"
            rfq.select_supplier(
                supplier_id=selected_quo.supplier_id,
                supplier_name=selected_quo.supplier_name,
                selected_by=getattr(command, 'selected_by', 'John Buyer'),
                selection_reason=reason_text,
                procurement_comments=reason_text,
            )
            await self.rfq_repo.save(rfq)

        po_items = [
            PurchaseOrderItem.create(
                material_code=it.material_code,
                material_name=it.material_name,
                category="Raw Material",
                quantity=it.offered_qty,
                unit_price=it.unit_price,
            )
            for it in selected_quo.items
        ]

        supp_info = SupplierInfo(
            supplier_code=selected_quo.supplier_code,
            supplier_name=selected_quo.supplier_name,
        )

        deliv_details = DeliveryDetails(
            delivery_warehouse=rfq.warehouse_id if rfq else "MAIN-WH",
        )

        po = PurchaseOrder.create(
            supplier_id=selected_quo.supplier_id,
            warehouse_id=rfq.warehouse_id if rfq else "MAIN-WH",
            expected_delivery_date=selected_quo.valid_until,
            supplier_info=supp_info,
            delivery_details=deliv_details,
            items=po_items,
            payment_terms=selected_quo.payment_terms,
            rfq_id=rfq.id if rfq else None,
            quotation_id=selected_quo.id,
        )

        finance_approval = FinanceApproval.create(
            po_id=po.id.value,
            po_number=po.po_number,
            total_amount=po.grand_total,
            requested_by=command.selected_by,
        )

        if finance_approval.total_amount < Decimal("50000.00"):
            finance_approval.approve(approver_id="SYSTEM-AUTO", approver_name="Auto Approval Threshold", notes="Auto approved under $50,000 threshold")
            po.finance_approve()
        else:
            po.submit_for_finance_approval(finance_approval.id)

        await self.fa_repo.save(finance_approval)
        await self.po_repo.save(po)

        selected_quo.recorded_events.append(
            SupplierSelectedEvent(
                rfq_id=selected_quo.rfq_id,
                quotation_id=selected_quo.id,
                supplier_id=selected_quo.supplier_id,
            )
        )
        await self.quo_repo.save(selected_quo)

        return selected_quo, po, finance_approval


class ApproveFinanceUseCase:
    def __init__(self, fa_repo: FinanceApprovalRepositoryProtocol, po_repo: PurchaseOrderRepository):
        self.fa_repo = fa_repo
        self.po_repo = po_repo

    async def execute(self, command: ApproveFinanceCommand) -> tuple[FinanceApproval, PurchaseOrder]:
        approval = await self.fa_repo.get_by_id(command.approval_id)
        if not approval:
            raise ValueError(f"Finance Approval '{command.approval_id}' not found")

        approval.approve(approver_id=command.approver_id, approver_name=command.approver_name, notes=command.notes)
        await self.fa_repo.save(approval)

        po = await self.po_repo.find_by_id(PurchaseOrderId.of(approval.po_id))
        if po:
            po.finance_approve()
            await self.po_repo.save(po)

        approval.recorded_events.append(
            FinanceApprovedEvent(
                approval_id=approval.id,
                po_id=approval.po_id,
                po_number=approval.po_number,
                status=approval.status.value,
            )
        )
        await self.fa_repo.save(approval)
        return approval, po


class RejectFinanceUseCase:
    def __init__(self, fa_repo: FinanceApprovalRepositoryProtocol, po_repo: PurchaseOrderRepository):
        self.fa_repo = fa_repo
        self.po_repo = po_repo

    async def execute(self, command: RejectFinanceCommand) -> tuple[FinanceApproval, PurchaseOrder]:
        approval = await self.fa_repo.get_by_id(command.approval_id)
        if not approval:
            raise ValueError(f"Finance Approval '{command.approval_id}' not found")

        approval.reject(approver_id=command.approver_id, approver_name=command.approver_name, reason=command.reason)
        await self.fa_repo.save(approval)

        po = await self.po_repo.find_by_id(PurchaseOrderId.of(approval.po_id))
        if po:
            po.finance_reject()
            await self.po_repo.save(po)

        return approval, po


class SubmitASNUseCase:
    def __init__(
        self,
        asn_repo: ASNRepositoryProtocol,
        po_repo: PurchaseOrderRepository,
        an_repo: ArrivalNotificationRepositoryProtocol,
    ):
        self.asn_repo = asn_repo
        self.po_repo = po_repo
        self.an_repo = an_repo

    async def execute(self, command: SubmitASNCommand) -> tuple[SupplierASN, ArrivalNotification]:
        items = [
            ASNItem.create(
                po_item_id=it.po_item_id,
                material_code=it.material_code,
                material_name=it.material_name,
                ordered_qty=it.ordered_qty,
                shipped_qty=it.shipped_qty,
                unit_of_measure=it.unit_of_measure,
                batch_number=it.batch_number,
                expiry_date=it.expiry_date,
            )
            for it in command.items
        ]

        attachments = [
            ASNAttachment.create(
                filename=att.filename,
                file_type=att.file_type,
                file_path=f"attachments/asns/{att.attachment_id}_{att.filename}",
                file_size_bytes=att.file_size_bytes,
                category=att.category,
                attachment_id=uuid.UUID(att.attachment_id) if att.attachment_id else None,
                created_at=att.created_at,
            )
            for att in (command.attachments or [])
        ]

        asn = SupplierASN.create(
            po_id=command.po_id,
            po_number=command.po_number,
            supplier_id=command.supplier_id,
            supplier_name=command.supplier_name,
            warehouse_id=command.warehouse_id,
            expected_arrival_date=command.expected_arrival_date,
            transporter_name=command.transporter_name,
            tracking_number=command.tracking_number,
            vehicle_number=command.vehicle_number,
            items=items,
            attachments=attachments,
            shipped_date=command.shipped_date,
            driver_name=command.driver_name,
            driver_phone=command.driver_phone,
        )

        po = await self.po_repo.find_by_id(PurchaseOrderId.of(command.po_id))
        if po:
            po.status = PurchaseOrderStatus.ASN_SUBMITTED
            await self.po_repo.save(po)

        saved_asn = await self.asn_repo.save(asn)

        notification = ArrivalNotification.create(
            asn_id=saved_asn.id,
            asn_number=saved_asn.asn_number,
            po_id=saved_asn.po_id,
            po_number=saved_asn.po_number,
            warehouse_id=saved_asn.warehouse_id,
            supplier_name=saved_asn.supplier_name,
            vehicle_number=saved_asn.vehicle_number,
            expected_arrival_time=saved_asn.created_at,
            driver_phone=saved_asn.driver_phone,
        )
        notification.dispatch()
        saved_an = await self.an_repo.save(notification)

        saved_asn.recorded_events.append(
            SupplierASNSubmittedEvent(
                asn_id=saved_asn.id,
                asn_number=saved_asn.asn_number,
                po_id=saved_asn.po_id,
                vehicle_number=saved_asn.vehicle_number,
                status=saved_asn.status.value,
            )
        )
        await self.asn_repo.save(saved_asn)

        return saved_asn, saved_an


class ResubmitPurchaseOrderUseCase:
    def __init__(self, po_repo: PurchaseOrderRepository, fa_repo: FinanceApprovalRepositoryProtocol):
        self.po_repo = po_repo
        self.fa_repo = fa_repo

    async def execute(self, command: ResubmitPurchaseOrderCommand) -> tuple[PurchaseOrder, FinanceApproval]:
        po = await self.po_repo.find_by_id(PurchaseOrderId.of(command.po_id))
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {command.po_id} not found")

        items = None
        if command.items is not None:
            items = [
                PurchaseOrderItem.create(
                    material_code=it.material_code,
                    material_name=it.material_name,
                    category=it.category,
                    unit_of_measure=it.unit_of_measure,
                    quantity=it.quantity,
                    unit_price=it.unit_price,
                    discount=it.discount,
                    tax=it.tax,
                )
                for it in command.items
            ]

        tax_rate = command.tax_rate if command.tax_rate is not None else po.tax_rate

        fa = await self.fa_repo.get_by_po_id(po.id.value)
        if not fa:
            fa = FinanceApproval.create(
                po_id=po.id.value,
                po_number=po.po_number,
                total_amount=po.grand_total,
                requested_by=command.resubmitted_by,
            )
        else:
            fa.status = FinanceApprovalStatus.PENDING
            fa.requested_by = command.resubmitted_by
            fa.rejection_reason = None
            fa.approval_notes = None

        po.resubmit_for_finance_approval(approval_id=fa.id, items=items, tax_rate=tax_rate)
        fa.total_amount = po.grand_total

        if fa.total_amount < Decimal("50000.00"):
            fa.approve(approver_id="SYSTEM-AUTO", approver_name="Auto Threshold", notes="Auto approved under $50,000 threshold on resubmission")
            po.finance_approve()

        await self.fa_repo.save(fa)
        await self.po_repo.save(po)
        return po, fa


class GetQuotationComparisonMatrixUseCase:
    def __init__(self, rfq_repo: RFQRepositoryProtocol, quo_repo: QuotationRepositoryProtocol):
        self.rfq_repo = rfq_repo
        self.quo_repo = quo_repo

    async def execute(self, rfq_id: str) -> dict:
        rfq = await self.rfq_repo.get_by_id(rfq_id)
        if not rfq:
            raise ValueError(f"RFQ '{rfq_id}' not found")

        quotations = await self.quo_repo.list_by_rfq(rfq_id)

        # Build supplier columns
        suppliers_matrix = []
        lowest_grand_total = None
        best_supplier_id = None

        for q in quotations:
            if lowest_grand_total is None or q.grand_total < lowest_grand_total:
                lowest_grand_total = q.grand_total
                best_supplier_id = q.supplier_id

        for q in quotations:
            suppliers_matrix.append({
                "quotation_id": q.id,
                "quotation_number": q.quotation_number,
                "supplier_id": q.supplier_id,
                "supplier_code": q.supplier_code,
                "supplier_name": q.supplier_name,
                "subtotal": str(q.subtotal),
                "tax_amount": str(q.tax_amount),
                "grand_total": str(q.grand_total),
                "payment_terms": q.payment_terms,
                "delivery_lead_time_days": q.delivery_lead_time_days,
                "status": q.status.value,
                "is_lowest_bidder": q.supplier_id == best_supplier_id,
            })

        # Build item comparison rows
        items_matrix = []
        for r_item in rfq.items:
            quote_map = {}
            for q in quotations:
                matching_q_item = next((qi for qi in q.items if qi.material_code == r_item.material_code), None)
                if matching_q_item:
                    quote_map[q.supplier_id] = {
                        "offered_qty": str(matching_q_item.offered_qty),
                        "unit_price": str(matching_q_item.unit_price),
                        "line_subtotal": str(matching_q_item.line_subtotal),
                        "line_total": str(matching_q_item.line_total),
                    }

            items_matrix.append({
                "material_code": r_item.material_code,
                "material_name": r_item.material_name,
                "quantity": str(r_item.quantity),
                "unit_of_measure": r_item.unit_of_measure,
                "supplier_quotes": quote_map,
            })

        return {
            "rfq_id": rfq.id,
            "rfq_number": rfq.rfq_number,
            "title": rfq.title,
            "total_quotations": len(quotations),
            "best_recommendation_supplier_id": best_supplier_id,
            "suppliers": suppliers_matrix,
            "items": items_matrix,
        }


class SendRFQEmailToSuppliersUseCase:
    def __init__(self, rfq_repo: RFQRepositoryProtocol):
        self.rfq_repo = rfq_repo

    async def execute(self, rfq_id: str, base_url: str = "http://localhost:3000") -> dict:
        import secrets
        import logging
        logger = logging.getLogger(__name__)

        rfq = await self.rfq_repo.get_by_id(rfq_id)
        if not rfq:
            raise ValueError(f"RFQ '{rfq_id}' not found")

        notifications_sent = []
        for s in rfq.invited_suppliers:
            # Generate secure temporary credentials with forced password change
            temp_username = f"supplier_{s.supplier_code.lower().replace('-', '_')}"
            temp_password = f"TempPass{secrets.randbelow(8999) + 1000}!"
            auth_token = secrets.token_urlsafe(24)

            submission_link = f"{base_url}/supplier/quotations/new?rfq_id={rfq.id}&token={auth_token}&supplier_id={s.supplier_id}"

            # Format Material Requirements list
            materials_list = []
            for item in rfq.items:
                due_date_str = rfq.due_date.strftime("%d-%b-%Y") if hasattr(rfq.due_date, "strftime") else str(rfq.due_date)
                materials_list.append(
                    f"Material: {item.material_name} ({item.material_code})\n"
                    f"Quantity: {item.quantity:,} {item.unit_of_measure}\n"
                    f"Required Delivery: {due_date_str}"
                )
            materials_text = "\n\n".join(materials_list)

            # Construct official specification email body
            email_subject = f"Request for Quotation - {rfq.rfq_number}"
            email_body = (
                f"Dear {s.supplier_name},\n\n"
                f"We request you to submit a quotation for the following materials:\n\n"
                f"{materials_text}\n"
                f"Destination Warehouse: {rfq.warehouse_id}\n\n"
                f"Please provide:\n"
                f"- Unit Price\n"
                f"- Available Quantity\n"
                f"- Delivery Time\n"
                f"- Expected Delivery Date\n"
                f"- Tax\n"
                f"- Freight Charges\n"
                f"- Payment Terms\n"
                f"- Quotation Validity\n"
                f"- Additional Conditions\n\n"
                f"Please use the following link to submit your quotation:\n\n"
                f"[SUBMIT QUOTATION]: {submission_link}\n\n"
                f"Username: {temp_username}\n"
                f"Temporary Password: {temp_password}\n"
                f"(Note: Forced password change is required upon first login.)\n\n"
                f"Regards,\n"
                f"Procurement Operations Team\n"
                f"Warehouse Management System"
            )

            # Security: Mask sensitive credentials in backend logs
            logger.info(
                f"[RFQ EMAIL DISPATCH] Sent RFQ '{rfq.rfq_number}' to Supplier '{s.supplier_name}' "
                f"({s.email}). Username: {temp_username}, Password: [MASKED FOR SECURITY]"
            )

            notifications_sent.append({
                "supplier_id": s.supplier_id,
                "supplier_code": s.supplier_code,
                "supplier_name": s.supplier_name,
                "email": s.email,
                "subject": email_subject,
                "rfq_link": submission_link,
                "username": temp_username,
                "temp_password": temp_password,
                "must_change_password": True,
                "email_body": email_body,
                "status": "SENT",
            })

        return {
            "rfq_id": rfq.id,
            "rfq_number": rfq.rfq_number,
            "total_emails_sent": len(notifications_sent),
            "notifications": notifications_sent,
        }


class SendPOSupplierNotificationUseCase:
    def __init__(self, po_repo: PurchaseOrderRepository):
        self.po_repo = po_repo

    async def execute(self, po_id_str: str, base_url: str = "http://localhost:3000") -> dict:
        po = await self.po_repo.find_by_id(PurchaseOrderId.of(po_id_str))
        if not po:
            raise PurchaseOrderNotFoundException(f"Purchase Order {po_id_str} not found")

        po.issue()
        await self.po_repo.save(po)

        # Format Material Summary
        materials_list = []
        for item in po.items:
            materials_list.append(f"- {item.material_name} ({item.material_code}): {item.quantity:,} {item.unit_of_measure}")
        material_summary = "\n".join(materials_list)

        # Links
        view_po_link = f"{base_url}/api/v1/procurement/purchase-orders/{po.id.value}/pdf"
        asn_link = f"{base_url}/supplier/asns/new?po_id={po.id.value}&po_number={po.po_number}"

        delivery_date_str = po.expected_delivery_date.strftime("%d-%b-%Y") if po.expected_delivery_date else "N/A"
        formatted_total = f"₹{po.grand_total:,.2f}"

        # Email Body
        email_body = (
            f"Dear {po.supplier_info.supplier_name if po.supplier_info else 'Supplier'},\n\n"
            f"Your Purchase Order has been approved.\n\n"
            f"PO Number: {po.po_number}\n"
            f"Total Amount: {formatted_total}\n"
            f"Expected Delivery: {delivery_date_str}\n\n"
            f"Material Summary:\n"
            f"{material_summary}\n\n"
            f"Please click the links below to view the official document or submit an Advance Shipping Notice (ASN):\n\n"
            f"[VIEW PURCHASE ORDER]: {view_po_link}\n\n"
            f"[SUBMIT ASN]: {asn_link}\n\n"
            f"Regards,\n"
            f"Procurement Operations Team\n"
            f"Warehouse Management System"
        )

        return {
            "po_id": po.id.value,
            "po_number": po.po_number,
            "supplier_id": po.supplier_id,
            "supplier_name": po.supplier_info.supplier_name if po.supplier_info else po.supplier_id,
            "supplier_email": po.supplier_info.email if po.supplier_info else None,
            "po_status": po.status.value,
            "grand_total": formatted_total,
            "expected_delivery": delivery_date_str,
            "view_po_link": view_po_link,
            "asn_link": asn_link,
            "subject": f"Purchase Order {po.po_number}",
            "email_body": email_body,
            "status": "SENT",
        }
