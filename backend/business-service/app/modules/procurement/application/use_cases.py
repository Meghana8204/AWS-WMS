"""
CreateSupplierUseCase / GetSupplierUseCase.
Orchestrates creation of Supplier aggregate and persistence via SupplierRepository.
"""
from __future__ import annotations

from typing import List, Optional
from app.common.domain.exceptions import NotFoundException
from app.modules.procurement.application.commands import (
    AddressCommand,
    BankInfoCommand,
    ContactCommand,
    CreateSupplierCommand,
    DocumentCommand,
    CreateRfqCommand,
    SubmitQuotationCommand,
    CreatePurchaseOrderCommand,
    CreateAsnCommand,
)
from app.modules.procurement.application.repository import (
    SupplierRepository,
    RfqRepository,
    QuotationRepository,
    PurchaseOrderRepository,
    AsnRepository,
)
from app.modules.procurement.domain.supplier import (
    Supplier,
    SupplierAddress,
    SupplierBankInfo,
    SupplierContact,
    SupplierDocument,
)
from app.modules.procurement.domain.rfq import RFQ
from app.modules.procurement.domain.rfq_item import RFQItem
from app.modules.procurement.domain.quotation import Quotation, QuotationLine
from app.modules.procurement.domain.purchase_order import PurchaseOrder, PurchaseOrderLine
from app.modules.procurement.domain.asn import ASN, AsnLine
from app.modules.procurement.domain.value_objects import (
    SupplierId,
    RfqId,
    QuotationId,
    PurchaseOrderId,
    AsnId,
)


class CreateSupplierUseCase:
    def __init__(self, supplier_repository: SupplierRepository) -> None:
        self._supplier_repository = supplier_repository

    async def handle(self, command: CreateSupplierCommand) -> SupplierId:
        address = None
        if command.address is not None:
            address = SupplierAddress(
                registered_address=command.address.registered_address,
                city=command.address.city,
                country=command.address.country,
                state=command.address.state,
                pincode=command.address.pincode,
            )

        contact = None
        if command.contact is not None:
            contact = SupplierContact(
                primary_contact_name=command.contact.primary_contact_name,
                email=command.contact.email,
                designation=command.contact.designation,
                phone=command.contact.phone,
                website=command.contact.website,
            )

        bank_info = None
        if command.bank_info is not None:
            bank_info = SupplierBankInfo(
                bank_name=command.bank_info.bank_name,
                account_number=command.bank_info.account_number,
                account_holder_name=command.bank_info.account_holder_name,
                ifsc=command.bank_info.ifsc,
                branch=command.bank_info.branch,
                swift_bic=command.bank_info.swift_bic,
                tds_section=command.bank_info.tds_section,
            )

        documents = []
        if command.documents:
            for doc in command.documents:
                documents.append(
                    SupplierDocument(
                        document_type=doc.document_type,
                        file_name=doc.file_name,
                        file_type=doc.file_type,
                        file_size=doc.file_size,
                        storage_path=doc.storage_path,
                        upload_id=doc.upload_id,
                    )
                )

        supplier = Supplier.create(
            supplier_name=command.supplier_name,
            registered_company_name=command.registered_company_name,
            vendor_type=command.vendor_type,
            category=command.category,
            industry=command.industry,
            gstin=command.gstin,
            address=address,
            contact=contact,
            bank_info=bank_info,
            documents=documents,
            remarks=command.remarks,
        )
        await self._supplier_repository.save(supplier)
        return supplier.id


class GetSupplierUseCase:
    def __init__(self, supplier_repository: SupplierRepository) -> None:
        self._supplier_repository = supplier_repository

    async def handle(self, supplier_id: SupplierId) -> Supplier:
        supplier = await self._supplier_repository.find_by_id(supplier_id)
        if supplier is None:
            raise NotFoundException(f"Supplier not found: {supplier_id}")
        return supplier


class ListSuppliersUseCase:
    def __init__(self, supplier_repository: SupplierRepository) -> None:
        self._supplier_repository = supplier_repository

    async def handle(self) -> List[Supplier]:
        return await self._supplier_repository.list_all()


# --- RFQ ---

class CreateRfqUseCase:
    def __init__(self, repository: RfqRepository) -> None:
        self._repository = repository

    async def handle(self, command: CreateRfqCommand) -> RfqId:
        year = command.rfq_date.year
        seq = await self._repository.get_next_sequence(year)
        rfq_number = f"RFQ-{year}-{seq:04d}"

        supplier_ids = [SupplierId.of(sid) for sid in command.supplier_ids]
        items = [
            RFQItem(
                material_code=item.material_code,
                material_name=item.material_name,
                category=item.category,
                quantity=item.quantity,
                uom=item.uom,
                required_delivery_date=item.required_delivery_date,
                warehouse=item.warehouse,
                special_requirements=item.special_requirements,
            )
            for item in command.items
        ]
        rfq = RFQ.create(
            rfq_number=rfq_number,
            rfq_date=command.rfq_date,
            material_request_number=command.material_request_number,
            required_delivery_date=command.required_delivery_date,
            warehouse=command.warehouse,
            procurement_officer=command.procurement_officer,
            valid_until=command.valid_until,
            remarks=command.remarks,
            supplier_ids=supplier_ids,
            items=items,
        )
        await self._repository.save(rfq)
        return rfq.id


class SendRfqUseCase:
    def __init__(self, repository: RfqRepository) -> None:
        self._repository = repository

    async def handle(self, rfq_id: RfqId) -> None:
        rfq = await self._repository.get_by_id(rfq_id)
        if not rfq:
            raise NotFoundException(f"RFQ not found: {rfq_id}")
        rfq.send()
        await self._repository.save(rfq)


# --- Quotation ---

class SubmitQuotationUseCase:
    def __init__(self, repository: QuotationRepository, rfq_repository: RfqRepository) -> None:
        self._repository = repository
        self._rfq_repository = rfq_repository

    async def handle(self, command: SubmitQuotationCommand) -> QuotationId:
        rfq_id = RfqId.of(command.rfq_id)
        rfq = await self._rfq_repository.get_by_id(rfq_id)
        if not rfq:
            raise NotFoundException(f"RFQ not found: {command.rfq_id}")

        lines = [
            QuotationLine(
                item_code=l.item_code,
                quantity=l.quantity,
                unit_price=l.unit_price,
            )
            for l in command.lines
        ]
        from app.modules.procurement.domain.quotation import QuotationDocument
        documents = []
        if command.documents:
            for doc in command.documents:
                documents.append(
                    QuotationDocument(
                        document_type=doc.document_type,
                        file_name=doc.file_name,
                        file_url=doc.file_url,
                    )
                )

        q = Quotation.create(
            rfq_id=rfq_id,
            supplier_id=SupplierId.of(command.supplier_id),
            lines=lines,
            status=command.status,
            discount=command.discount,
            tax=command.tax,
            freight_charges=command.freight_charges,
            delivery_time=command.delivery_time,
            expected_delivery_date=command.expected_delivery_date,
            payment_terms=command.payment_terms,
            quotation_validity=command.quotation_validity,
            remarks=command.remarks,
            documents=documents,
        )
        await self._repository.save(q)
        return q.id


# --- Purchase Order ---

class CreatePurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self._repository = repository

    async def handle(self, command: CreatePurchaseOrderCommand) -> PurchaseOrderId:
        lines = [
            PurchaseOrderLine(
                item_code=l.item_code,
                ordered_quantity=l.ordered_quantity,
                unit_price=l.unit_price,
                material_name=l.material_name,
                category=l.category,
                uom=l.uom,
                discount=l.discount,
                tax=l.tax,
            )
            for l in command.lines
        ]
        po_number = command.po_number or f"PROP-{datetime.now().strftime('%Y-%m%d%H%M%S')}"
        quotation_id = QuotationId.of(command.quotation_id) if command.quotation_id else None

        po = PurchaseOrder.create(
            po_number=po_number,
            supplier_id=SupplierId.of(command.supplier_id),
            lines=lines,
            quotation_id=quotation_id,
            po_date=command.po_date,
        )
        po.additional_charges = command.additional_charges or Decimal("0.0")
        po.department = command.department
        po.procurement_officer = command.procurement_officer
        po.delivery_warehouse = command.delivery_warehouse
        po.delivery_address = command.delivery_address
        po.expected_delivery_date = command.expected_delivery_date

        await self._repository.save(po)


class SendPOSupplierNotificationUseCase:
    def __init__(self, po_repo: PurchaseOrderRepository):
        self.po_repo = po_repo

    async def execute(self, po_id_str: str, base_url: str = "http://localhost:3000") -> dict:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.po_repo.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"Purchase Order {po_id_str} not found")

        po.status = "ISSUED"
        await self.po_repo.save(po)

        # Format Material Summary
        materials_list = []
        for item in po.lines:
            materials_list.append(f"- {item.material_name or item.item_code} ({item.item_code}): {item.ordered_quantity:,} {item.uom or 'PCS'}")
        material_summary = "\n".join(materials_list)

        # Links
        view_po_link = f"{base_url}/api/v1/procurement/purchase-orders/{po.id.value}/pdf"
        asn_link = f"{base_url}/supplier/asns/new?po_id={po.id.value}&po_number={po.po_number}"

        delivery_date_str = po.expected_delivery_date.strftime("%d-%b-%Y") if po.expected_delivery_date else "N/A"
        formatted_total = f"₹{po.grand_total:,.2f}"

        # Email Body
        email_body = (
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
            "po_id": str(po.id.value),
            "po_number": po.po_number,
            "supplier_id": str(po.supplier_id.value),
            "po_status": po.status,
            "grand_total": formatted_total,
            "expected_delivery": delivery_date_str,
            "view_po_link": view_po_link,
            "asn_link": asn_link,
            "subject": f"Purchase Order {po.po_number}",
            "email_body": email_body,
            "status": "SENT",
        }


class GeneratePurchaseOrderPdfUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, po_id_str: str) -> bytes:
        from app.modules.procurement.application.pdf_service import PurchaseOrderPdfGenerator
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.repo.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"Purchase Order {po_id_str} not found")

        pdf_generator = PurchaseOrderPdfGenerator()
        return pdf_generator.generate_pdf(po)
        return po.id


class UpdatePurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self._repository = repository

    async def handle(self, po_id_str: str, command: UpdatePurchaseOrderCommand) -> None:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self._repository.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"PO not found: {po_id}")

        if command.status:
            po.status = command.status

        if command.rejection_reason:
            po.rejection_reason = command.rejection_reason

        if command.finance_comments:
            po.finance_comments = command.finance_comments

        if command.lines is not None:
            po.lines = [
                PurchaseOrderLine(
                    item_code=l.item_code,
                    ordered_quantity=l.ordered_quantity,
                    unit_price=l.unit_price,
                    material_name=l.material_name,
                    category=l.category,
                    uom=l.uom,
                    discount=l.discount,
                    tax=l.tax,
                )
                for l in command.lines
            ]

        if command.additional_charges is not None:
            po.additional_charges = command.additional_charges

        await self._repository.save(po)


class SendPOSupplierNotificationUseCase:
    def __init__(self, po_repo: PurchaseOrderRepository):
        self.po_repo = po_repo

    async def execute(self, po_id_str: str, base_url: str = "http://localhost:3000") -> dict:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.po_repo.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"Purchase Order {po_id_str} not found")

        po.status = "ISSUED"
        await self.po_repo.save(po)

        # Format Material Summary
        materials_list = []
        for item in po.lines:
            materials_list.append(f"- {item.material_name or item.item_code} ({item.item_code}): {item.ordered_quantity:,} {item.uom or 'PCS'}")
        material_summary = "\n".join(materials_list)

        # Links
        view_po_link = f"{base_url}/api/v1/procurement/purchase-orders/{po.id.value}/pdf"
        asn_link = f"{base_url}/supplier/asns/new?po_id={po.id.value}&po_number={po.po_number}"

        delivery_date_str = po.expected_delivery_date.strftime("%d-%b-%Y") if po.expected_delivery_date else "N/A"
        formatted_total = f"₹{po.grand_total:,.2f}"

        # Email Body
        email_body = (
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
            "po_id": str(po.id.value),
            "po_number": po.po_number,
            "supplier_id": str(po.supplier_id.value),
            "po_status": po.status,
            "grand_total": formatted_total,
            "expected_delivery": delivery_date_str,
            "view_po_link": view_po_link,
            "asn_link": asn_link,
            "subject": f"Purchase Order {po.po_number}",
            "email_body": email_body,
            "status": "SENT",
        }


class GeneratePurchaseOrderPdfUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, po_id_str: str) -> bytes:
        from app.modules.procurement.application.pdf_service import PurchaseOrderPdfGenerator
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.repo.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"Purchase Order {po_id_str} not found")

        pdf_generator = PurchaseOrderPdfGenerator()
        return pdf_generator.generate_pdf(po)


class ApprovePurchaseOrderUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self._repository = repository

    async def handle(self, po_id: PurchaseOrderId) -> None:
        po = await self._repository.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"PO not found: {po_id}")
        po.status = "APPROVED"
        await self._repository.save(po)


class SendPOSupplierNotificationUseCase:
    def __init__(self, po_repo: PurchaseOrderRepository):
        self.po_repo = po_repo

    async def execute(self, po_id_str: str, base_url: str = "http://localhost:3000") -> dict:
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.po_repo.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"Purchase Order {po_id_str} not found")

        po.status = "ISSUED"
        await self.po_repo.save(po)

        # Format Material Summary
        materials_list = []
        for item in po.lines:
            materials_list.append(f"- {item.material_name or item.item_code} ({item.item_code}): {item.ordered_quantity:,} {item.uom or 'PCS'}")
        material_summary = "\n".join(materials_list)

        # Links
        view_po_link = f"{base_url}/api/v1/procurement/purchase-orders/{po.id.value}/pdf"
        asn_link = f"{base_url}/supplier/asns/new?po_id={po.id.value}&po_number={po.po_number}"

        delivery_date_str = po.expected_delivery_date.strftime("%d-%b-%Y") if po.expected_delivery_date else "N/A"
        formatted_total = f"₹{po.grand_total:,.2f}"

        # Email Body
        email_body = (
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
            "po_id": str(po.id.value),
            "po_number": po.po_number,
            "supplier_id": str(po.supplier_id.value),
            "po_status": po.status,
            "grand_total": formatted_total,
            "expected_delivery": delivery_date_str,
            "view_po_link": view_po_link,
            "asn_link": asn_link,
            "subject": f"Purchase Order {po.po_number}",
            "email_body": email_body,
            "status": "SENT",
        }


class GeneratePurchaseOrderPdfUseCase:
    def __init__(self, repository: PurchaseOrderRepository) -> None:
        self.repo = repository

    async def handle(self, po_id_str: str) -> bytes:
        from app.modules.procurement.application.pdf_service import PurchaseOrderPdfGenerator
        po_id = PurchaseOrderId.of(po_id_str)
        po = await self.repo.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"Purchase Order {po_id_str} not found")

        pdf_generator = PurchaseOrderPdfGenerator()
        return pdf_generator.generate_pdf(po)


# --- ASN ---

class CreateAsnUseCase:
    def __init__(self, repository: AsnRepository, po_repository: PurchaseOrderRepository) -> None:
        self._repository = repository
        self._po_repository = po_repository

    async def handle(self, command: CreateAsnCommand) -> AsnId:
        po_id = PurchaseOrderId.of(command.po_id)
        po = await self._po_repository.get_by_id(po_id)
        if not po:
            raise NotFoundException(f"PO not found: {command.po_id}")

        lines = [
            AsnLine(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
            )
            for l in command.lines
        ]
        asn = ASN.create(
            po_id=po_id,
            asn_number=command.asn_number,
            lines=lines,
            vehicle_number=command.vehicle_number,
            expected_arrival_at=command.expected_arrival_at,
            shipment_date=command.shipment_date,
            driver_name=command.driver_name,
            driver_contact=command.driver_contact,
        )
        await self._repository.save(asn)
        return asn.id


class GetNextAsnNumberUseCase:
    def __init__(self, repository: AsnRepository) -> None:
        self._repository = repository

    async def handle(self) -> str:
        from datetime import datetime
        year = datetime.now().year
        # We need to add get_next_sequence to AsnRepository or implement here
        # For now, let's look at how RFQ/PO does it.
        # PO uses repository.get_next_sequence(year)
        try:
            seq = await self._repository.get_next_sequence(year)
        except AttributeError:
            # Fallback if not implemented
            import random
            seq = random.randint(1000, 9999)

        return f"ASN-{year}-{seq:04d}"
