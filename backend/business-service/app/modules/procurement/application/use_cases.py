"""
Procurement module use cases (Supplier, RFQ, Quotation, ASN).
Purchase Order module has been removed.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from app.common.domain.exceptions import NotFoundException, DomainRuleViolationException
from app.modules.procurement.application.commands import (
    AddressCommand,
    BankInfoCommand,
    ContactCommand,
    CreateSupplierCommand,
    DocumentCommand,
    CreateRfqCommand,
    SubmitQuotationCommand,
    CreateAsnCommand,
)
from app.modules.procurement.application.repository import (
    SupplierRepository,
    RfqRepository,
    QuotationRepository,
    AsnRepository,
    ArrivalNotificationRepository,
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
from app.modules.procurement.domain.asn import ASN, AsnLine, AsnDocument
from app.modules.procurement.domain.value_objects import (
    SupplierId,
    RfqId,
    QuotationId,
    AsnId,
    PurchaseOrderId,
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
                primary_email=command.contact.primary_email,
                secondary_email=command.contact.secondary_email,
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
            main_materials=command.main_materials,
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


class UpdateSupplierUseCase:
    def __init__(self, supplier_repository: SupplierRepository) -> None:
        self._supplier_repository = supplier_repository

    async def handle(self, command: UpdateSupplierCommand) -> None:
        supplier = await self._supplier_repository.find_by_id(SupplierId.of(command.supplier_id))
        if not supplier:
            raise NotFoundException(f"Supplier not found: {command.supplier_id}")

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
                primary_email=command.contact.primary_email,
                secondary_email=command.contact.secondary_email,
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

        supplier.update(
            supplier_name=command.supplier_name,
            registered_company_name=command.registered_company_name,
            vendor_type=command.vendor_type,
            category=command.category,
            industry=command.industry,
            gstin=command.gstin,
            main_materials=command.main_materials,
            address=address,
            contact=contact,
            bank_info=bank_info,
            remarks=command.remarks,
        )
        await self._supplier_repository.save(supplier)


class BlockSupplierUseCase:
    def __init__(self, supplier_repository: SupplierRepository) -> None:
        self._supplier_repository = supplier_repository

    async def handle(self, supplier_id: str) -> None:
        supplier = await self._supplier_repository.find_by_id(SupplierId.of(supplier_id))
        if not supplier:
            raise NotFoundException(f"Supplier not found: {supplier_id}")
        supplier.block()
        await self._supplier_repository.save(supplier)


class UnblockSupplierUseCase:
    def __init__(self, supplier_repository: SupplierRepository) -> None:
        self._supplier_repository = supplier_repository

    async def handle(self, supplier_id: str) -> None:
        supplier = await self._supplier_repository.find_by_id(SupplierId.of(supplier_id))
        if not supplier:
            raise NotFoundException(f"Supplier not found: {supplier_id}")
        supplier.unblock()
        await self._supplier_repository.save(supplier)


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
                required_delivery_date=item.required_delivery_date or command.required_delivery_date,
                warehouse=item.warehouse or command.warehouse,
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


# --- ASN ---

class CreateAsnUseCase:
    def __init__(
        self,
        repository: AsnRepository,
        supplier_repository: SupplierRepository | None = None,
        notification_repository: ArrivalNotificationRepository | None = None
    ) -> None:
        self._repository = repository
        self._supplier_repository = supplier_repository
        self._notification_repository = notification_repository

    async def handle(self, command: CreateAsnCommand) -> AsnId:
        # ASNs are now independent of Purchase Orders.
        # po_id is optional, po_number is for reference.

        lines = [
            AsnLine(
                item_code=l.item_code,
                shipped_quantity=l.shipped_quantity,
                material_name=getattr(l, "material_name", None),
                uom=getattr(l, "uom", "PCS"),
            )
            for l in command.lines
        ]

        documents = [
            AsnDocument(
                document_type=d.document_type,
                file_name=d.file_name,
                file_url=d.file_url,
                uploaded_by=d.uploaded_by
            )
            for d in command.documents
        ]

        asn = ASN.create(
            asn_number=command.asn_number,
            lines=lines,
            po_id=PurchaseOrderId.of(command.po_id) if command.po_id else None,
            po_number=command.po_number,
            warehouse_id=getattr(command, "warehouse_id", "MAIN"),
            vehicle_number=command.vehicle_number,
            driver_name=command.driver_name,
            driver_contact=command.driver_contact,
            expected_arrival_at=command.expected_arrival_at,
            shipment_date=command.shipment_date,
            transporter=command.transporter,
            number_of_packages=command.number_of_packages,
            package_type=command.package_type,
            shipping_method=command.shipping_method,
            status=command.status if command.status else "DISPATCHED",
            documents=documents,
            supplier_id=command.supplier_id,
        )

        await self._repository.save(asn)

        # Create Arrival Notification for Warehouse
        if command.status == "SUBMITTED" and self._notification_repository:
            from app.modules.procurement.domain.arrival_notification import ArrivalNotification

            notif = ArrivalNotification.create(
                asn_id=str(asn.id),
                asn_number=asn.asn_number,
                po_id=command.po_id,
                po_number=asn.po_number or "N/A",
                warehouse_id=asn.warehouse_id or "MAIN",
                supplier_name="Supplier", # Simplified for now to avoid infra dependencies
                vehicle_number=asn.vehicle_number or "Unknown",
                expected_arrival_time=asn.expected_arrival_at or datetime.now(),
                driver_phone=asn.driver_contact,
            )
            await self._notification_repository.save(notif)

        return asn.id


class GetNextAsnNumberUseCase:
    def __init__(self, repository: AsnRepository) -> None:
        self._repository = repository

    async def handle(self) -> str:
        from datetime import datetime
        year = datetime.now().year
        try:
            seq = await self._repository.get_next_sequence(year)
        except:
            seq = 1

        return f"ASN-{year}-{seq:04d}"


class GetNextMaterialRequestNumberUseCase:
    def __init__(self, repository: MaterialRequestRepository) -> None:
        self._repository = repository

    async def handle(self) -> str:
        from datetime import datetime
        year_month = datetime.now().strftime("%Y%m")
        try:
            seq = await self._repository.get_next_sequence(year_month)
        except:
            seq = 1

        return f"MR-{year_month}-{seq:04d}"

