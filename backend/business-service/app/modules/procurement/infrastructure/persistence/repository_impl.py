"""
SqlAlchemy implementations for procurement repositories.
Persists aggregate states to PostgreSQL via AsyncSession.
"""
from __future__ import annotations

import uuid
from typing import List, Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.events.outbox_repository import to_outbox_row
from app.modules.procurement.application.repository import (
    AsnRepository,
    PurchaseOrderRepository,
    QuotationRepository,
    RfqRepository,
    SupplierRepository,
)
from app.modules.procurement.domain.asn import ASN, AsnLine
from app.modules.procurement.domain.purchase_order import PurchaseOrder, PurchaseOrderLine
from app.modules.procurement.domain.quotation import Quotation, QuotationLine
from app.modules.procurement.domain.rfq import RFQ
from app.modules.procurement.domain.rfq_item import RFQItem
from app.modules.procurement.domain.supplier import (
    Supplier,
    SupplierAddress,
    SupplierBankInfo,
    SupplierContact,
    SupplierDocument,
)
from app.modules.procurement.domain.value_objects import (
    AsnId,
    PurchaseOrderId,
    QuotationId,
    RfqId,
    SupplierId,
)
from app.modules.procurement.infrastructure.persistence.models import (
    AsnLineModel,
    AsnModel,
    PurchaseOrderLineModel,
    PurchaseOrderModel,
    QuotationLineModel,
    QuotationModel,
    RfqModel,
    RfqItemModel,
    SupplierAddressModel,
    SupplierBankInfoModel,
    SupplierContactModel,
    SupplierDocumentModel,
    SupplierModel,
    rfq_supplier_link,
)


class SqlAlchemySupplierRepository(SupplierRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def find_by_id(self, supplier_id: SupplierId) -> Optional[Supplier]:
        result = await self._session.execute(
            select(SupplierModel)
            .options(
                selectinload(SupplierModel.address),
                selectinload(SupplierModel.contact),
                selectinload(SupplierModel.bank_info),
                selectinload(SupplierModel.documents),
            )
            .where(SupplierModel.id == supplier_id.value)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            return None

        address = None
        if entity.address:
            address = SupplierAddress(
                registered_address=entity.address.registered_address,
                city=entity.address.city,
                country=entity.address.country,
                state=entity.address.state,
                pincode=entity.address.pincode,
            )

        contact = None
        if entity.contact:
            contact = SupplierContact(
                primary_contact_name=entity.contact.primary_contact_name,
                email=entity.contact.email,
                designation=entity.contact.designation,
                phone=entity.contact.phone,
                website=entity.contact.website,
            )

        bank_info = None
        if entity.bank_info:
            bank_info = SupplierBankInfo(
                bank_name=entity.bank_info.bank_name,
                account_number=entity.bank_info.account_number,
                account_holder_name=entity.bank_info.account_holder_name,
                ifsc=entity.bank_info.ifsc,
                branch=entity.bank_info.branch,
                swift_bic=entity.bank_info.swift_bic,
                tds_section=entity.bank_info.tds_section,
            )

        documents = [
            SupplierDocument(
                document_type=doc.document_type,
                file_name=doc.file_name,
                file_type=doc.file_type,
                file_size=doc.file_size,
                storage_path=doc.storage_path,
            )
            for doc in entity.documents
        ]

        return Supplier.rehydrate(
            id=SupplierId.of(entity.id),
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
            address=address,
            contact=contact,
            bank_info=bank_info,
            documents=documents,
            remarks=entity.remarks,
            status=entity.status,
        )

    async def list_all(self) -> List[Supplier]:
        result = await self._session.execute(
            select(SupplierModel).options(
                selectinload(SupplierModel.address),
                selectinload(SupplierModel.contact),
                selectinload(SupplierModel.bank_info),
                selectinload(SupplierModel.documents),
            )
        )
        entities = result.scalars().all()
        return [
            Supplier.rehydrate(
                id=SupplierId.of(e.id),
                supplier_name=e.supplier_name,
                registered_company_name=e.registered_company_name,
                vendor_type=e.vendor_type,
                category=e.category,
                industry=e.industry,
                gstin=e.gstin,
                supplier_code=e.supplier_code,
                main_material=e.main_material,
                rating=float(e.rating),
                performance_score=float(e.performance_score),
                address=SupplierAddress(
                    registered_address=e.address.registered_address,
                    city=e.address.city,
                    country=e.address.country,
                    state=e.address.state,
                    pincode=e.address.pincode,
                ) if e.address else None,
                contact=SupplierContact(
                    primary_contact_name=e.contact.primary_contact_name,
                    email=e.contact.email,
                    designation=e.contact.designation,
                    phone=e.contact.phone,
                    website=e.contact.website,
                ) if e.contact else None,
                bank_info=SupplierBankInfo(
                    bank_name=e.bank_info.bank_name,
                    account_number=e.bank_info.account_number,
                    account_holder_name=e.bank_info.account_holder_name,
                    ifsc=e.bank_info.ifsc,
                    branch=e.bank_info.branch,
                    swift_bic=e.bank_info.swift_bic,
                    tds_section=e.bank_info.tds_section,
                ) if e.bank_info else None,
                documents=[
                    SupplierDocument(
                        document_type=doc.document_type,
                        file_name=doc.file_name,
                        file_type=doc.file_type,
                        file_size=doc.file_size,
                        storage_path=doc.storage_path,
                    )
                    for doc in e.documents
                ],
                remarks=e.remarks,
                status=e.status,
            )
            for e in entities
        ]

    async def save(self, supplier: Supplier) -> None:
        entity = SupplierModel(
            id=supplier.id.value,
            supplier_name=supplier.supplier_name,
            registered_company_name=supplier.registered_company_name,
            vendor_type=supplier.vendor_type,
            category=supplier.category,
            industry=supplier.industry,
            gstin=supplier.gstin,
            supplier_code=supplier.supplier_code,
            main_material=supplier.main_material,
            rating=supplier.rating,
            performance_score=supplier.performance_score,
            remarks=supplier.remarks,
            status=supplier.status,
        )

        if supplier.address:
            entity.address = SupplierAddressModel(
                supplier_id=supplier.id.value,
                registered_address=supplier.address.registered_address,
                city=supplier.address.city,
                country=supplier.address.country,
                state=supplier.address.state,
                pincode=supplier.address.pincode,
            )

        if supplier.contact:
            entity.contact = SupplierContactModel(
                supplier_id=supplier.id.value,
                primary_contact_name=supplier.contact.primary_contact_name,
                email=supplier.contact.email,
                designation=supplier.contact.designation,
                phone=supplier.contact.phone,
                website=supplier.contact.website,
            )

        if supplier.bank_info:
            entity.bank_info = SupplierBankInfoModel(
                supplier_id=supplier.id.value,
                bank_name=supplier.bank_info.bank_name,
                account_number=supplier.bank_info.account_number,
                account_holder_name=supplier.bank_info.account_holder_name,
                ifsc=supplier.bank_info.ifsc,
                branch=supplier.bank_info.branch,
                swift_bic=supplier.bank_info.swift_bic,
                tds_section=supplier.bank_info.tds_section,
            )

        if supplier.documents:
            entity.documents = [
                SupplierDocumentModel(
                    supplier_id=supplier.id.value,
                    document_type=doc.document_type,
                    file_name=doc.file_name,
                    file_type=doc.file_type,
                    file_size=doc.file_size,
                    storage_path=doc.storage_path,
                )
                for doc in supplier.documents
            ]

        self._session.add(entity)
        for event in supplier.domain_events:
            self._session.add(to_outbox_row("Supplier", str(supplier.id), event))
        await self._session.flush()


class SqlAlchemyRfqRepository(RfqRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, rfq: RFQ) -> None:
        model = await self._session.get(RfqModel, rfq.id.value)
        if model:
            model.status = rfq.status
            model.closing_date = rfq.closing_date
            model.valid_until = rfq.valid_until
            model.remarks = rfq.remarks
            model.selected_supplier_id = rfq.selected_supplier_id.value if rfq.selected_supplier_id else None
            model.selection_date = rfq.selection_date
            model.selected_by = rfq.selected_by
            model.selection_reason = rfq.selection_reason
            model.selection_comments = rfq.selection_comments
            # Delete old items
            await self._session.execute(
                delete(RfqItemModel).where(RfqItemModel.rfq_id == rfq.id.value)
            )
        else:
            model = RfqModel(
                id=rfq.id.value,
                rfq_number=rfq.rfq_number,
                rfq_date=rfq.rfq_date,
                material_request_number=rfq.material_request_number,
                required_delivery_date=rfq.required_delivery_date,
                warehouse=rfq.warehouse,
                procurement_officer=rfq.procurement_officer,
                valid_until=rfq.valid_until,
                remarks=rfq.remarks,
                status=rfq.status,
                created_at=rfq.created_at,
                closing_date=rfq.closing_date,
                selected_supplier_id=rfq.selected_supplier_id.value if rfq.selected_supplier_id else None,
                selection_date=rfq.selection_date,
                selected_by=rfq.selected_by,
                selection_reason=rfq.selection_reason,
                selection_comments=rfq.selection_comments,
            )
            self._session.add(model)

        # Save items
        if rfq.items:
            model.items = [
                RfqItemModel(
                    id=None,  # let UUID default
                    rfq_id=rfq.id.value,
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
            ]

        # Update suppliers link table
        await self._session.execute(delete(rfq_supplier_link).where(rfq_supplier_link.c.rfq_id == rfq.id.value))
        for supplier_id in rfq.supplier_ids:
            await self._session.execute(
                rfq_supplier_link.insert().values(rfq_id=rfq.id.value, supplier_id=supplier_id.value)
            )

        for event in rfq.domain_events:
            self._session.add(to_outbox_row("RFQ", str(rfq.id), event))
        await self._session.flush()

    async def get_by_id(self, rfq_id: RfqId) -> Optional[RFQ]:
        result = await self._session.execute(
            select(RfqModel)
            .options(selectinload(RfqModel.items))
            .where(RfqModel.id == rfq_id.value)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None

        # Fetch supplier IDs
        suppliers_result = await self._session.execute(
            select(rfq_supplier_link.c.supplier_id).where(rfq_supplier_link.c.rfq_id == rfq_id.value)
        )
        supplier_ids = [SupplierId.of(row[0]) for row in suppliers_result]

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
            for item in model.items
        ]

        return RFQ(
            id=RfqId.of(model.id),
            rfq_number=model.rfq_number,
            rfq_date=model.rfq_date,
            warehouse=model.warehouse,
            procurement_officer=model.procurement_officer,
            status=model.status,
            supplier_ids=supplier_ids,
            items=items,
            material_request_number=model.material_request_number,
            required_delivery_date=model.required_delivery_date,
            valid_until=model.valid_until,
            remarks=model.remarks,
            created_at=model.created_at,
            closing_date=model.closing_date,
            selected_supplier_id=SupplierId.of(model.selected_supplier_id) if model.selected_supplier_id else None,
            selection_date=model.selection_date,
            selected_by=model.selected_by,
            selection_reason=model.selection_reason,
            selection_comments=model.selection_comments,
        )

    async def list_all(self) -> List[RFQ]:
        result = await self._session.execute(
            select(RfqModel)
            .options(selectinload(RfqModel.items))
            .order_by(RfqModel.created_at.desc())
        )
        models = result.scalars().all()
        rfqs = []
        for model in models:
            suppliers_result = await self._session.execute(
                select(rfq_supplier_link.c.supplier_id).where(rfq_supplier_link.c.rfq_id == model.id)
            )
            supplier_ids = [SupplierId.of(row[0]) for row in suppliers_result]
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
                for item in model.items
            ]
            rfqs.append(
                RFQ(
                    id=RfqId.of(model.id),
                    rfq_number=model.rfq_number,
                    rfq_date=model.rfq_date,
                    warehouse=model.warehouse,
                    procurement_officer=model.procurement_officer,
                    status=model.status,
                    supplier_ids=supplier_ids,
                    items=items,
                    material_request_number=model.material_request_number,
                    required_delivery_date=model.required_delivery_date,
                    valid_until=model.valid_until,
                    remarks=model.remarks,
                    created_at=model.created_at,
                    closing_date=model.closing_date,
                    selected_supplier_id=SupplierId.of(model.selected_supplier_id) if model.selected_supplier_id else None,
                    selection_date=model.selection_date,
                    selected_by=model.selected_by,
                    selection_reason=model.selection_reason,
                    selection_comments=model.selection_comments,
                )
            )
        return rfqs

    async def get_next_sequence(self, year: int) -> int:
        from sqlalchemy import func
        # Find the highest sequence number for the given year
        # rfq_number format: RFQ-YYYY-XXXX
        pattern = f"RFQ-{year}-%"
        result = await self._session.execute(
            select(func.max(RfqModel.rfq_number)).where(RfqModel.rfq_number.like(pattern))
        )
        max_rfq = result.scalar_one_or_none()
        if not max_rfq:
            return 1
        try:
            # Extract XXXX and increment
            parts = max_rfq.split("-")
            return int(parts[2]) + 1
        except (IndexError, ValueError):
            return 1


class SqlAlchemyQuotationRepository(QuotationRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, quotation: Quotation) -> None:
        from app.modules.procurement.infrastructure.persistence.models import QuotationDocumentModel
        model = await self._session.get(QuotationModel, quotation.id.value)
        if model:
            model.status = quotation.status
            model.total_amount = quotation.total_amount
            model.discount = quotation.discount
            model.tax = quotation.tax
            model.freight_charges = quotation.freight_charges
            model.delivery_time = quotation.delivery_time
            model.expected_delivery_date = quotation.expected_delivery_date
            model.payment_terms = quotation.payment_terms
            model.quotation_validity = quotation.quotation_validity
            model.remarks = quotation.remarks
            await self._session.execute(
                delete(QuotationLineModel).where(QuotationLineModel.quotation_id == quotation.id.value)
            )
            await self._session.execute(
                delete(QuotationDocumentModel).where(QuotationDocumentModel.quotation_id == quotation.id.value)
            )
        else:
            model = QuotationModel(
                id=quotation.id.value,
                rfq_id=quotation.rfq_id.value,
                supplier_id=quotation.supplier_id.value,
                status=quotation.status,
                total_amount=quotation.total_amount,
                discount=quotation.discount,
                tax=quotation.tax,
                freight_charges=quotation.freight_charges,
                delivery_time=quotation.delivery_time,
                expected_delivery_date=quotation.expected_delivery_date,
                payment_terms=quotation.payment_terms,
                quotation_validity=quotation.quotation_validity,
                remarks=quotation.remarks,
                created_at=quotation.created_at,
            )
            self._session.add(model)

        for line in quotation.lines:
            model.lines.append(
                QuotationLineModel(item_code=line.item_code, quantity=line.quantity, unit_price=line.unit_price)
            )

        for doc in quotation.documents:
            model.documents.append(
                QuotationDocumentModel(
                    document_type=doc.document_type,
                    file_name=doc.file_name,
                    file_url=doc.file_url,
                )
            )

        for event in quotation.domain_events:
            self._session.add(to_outbox_row("Quotation", str(quotation.id), event))
        await self._session.flush()

    async def get_by_id(self, quotation_id: QuotationId) -> Optional[Quotation]:
        from app.modules.procurement.domain.quotation import QuotationDocument
        result = await self._session.execute(
            select(QuotationModel)
            .options(selectinload(QuotationModel.lines), selectinload(QuotationModel.documents))
            .where(QuotationModel.id == quotation_id.value)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return Quotation(
            id=QuotationId.of(model.id),
            rfq_id=RfqId.of(model.rfq_id),
            supplier_id=SupplierId.of(model.supplier_id),
            status=model.status,
            lines=[
                QuotationLine(item_code=l.item_code, quantity=l.quantity, unit_price=l.unit_price)
                for l in model.lines
            ],
            total_amount=model.total_amount,
            created_at=model.created_at,
            discount=model.discount,
            tax=model.tax,
            freight_charges=model.freight_charges,
            delivery_time=model.delivery_time,
            expected_delivery_date=model.expected_delivery_date,
            payment_terms=model.payment_terms,
            quotation_validity=model.quotation_validity,
            remarks=model.remarks,
            documents=[
                QuotationDocument(
                    document_type=d.document_type,
                    file_name=d.file_name,
                    file_url=d.file_url,
                )
                for d in model.documents
            ],
        )

    async def list_all(self) -> List[Quotation]:
        from app.modules.procurement.domain.quotation import QuotationDocument
        result = await self._session.execute(
            select(QuotationModel).options(selectinload(QuotationModel.lines), selectinload(QuotationModel.documents))
        )
        models = result.scalars().all()
        return [
            Quotation(
                id=QuotationId.of(model.id),
                rfq_id=RfqId.of(model.rfq_id),
                supplier_id=SupplierId.of(model.supplier_id),
                status=model.status,
                lines=[
                    QuotationLine(item_code=l.item_code, quantity=l.quantity, unit_price=l.unit_price)
                    for l in model.lines
                ],
                total_amount=model.total_amount,
                created_at=model.created_at,
                discount=model.discount,
                tax=model.tax,
                freight_charges=model.freight_charges,
                delivery_time=model.delivery_time,
                expected_delivery_date=model.expected_delivery_date,
                payment_terms=model.payment_terms,
                quotation_validity=model.quotation_validity,
                remarks=model.remarks,
                documents=[
                    QuotationDocument(
                        document_type=d.document_type,
                        file_name=d.file_name,
                        file_url=d.file_url,
                    )
                    for d in model.documents
                ],
            )
            for model in models
        ]

    async def get_next_sequence(self, year: int) -> int:
        from sqlalchemy import func
        # Find the highest sequence number for the given year
        # asn_number format: ASN-YYYY-XXXX
        pattern = f"ASN-{year}-%"
        result = await self._session.execute(
            select(func.max(AsnModel.asn_number)).where(AsnModel.asn_number.like(pattern))
        )
        max_asn = result.scalar_one_or_none()
        if not max_asn:
            return 1
        try:
            # Extract XXXX and increment
            parts = max_asn.split("-")
            return int(parts[2]) + 1
        except (IndexError, ValueError):
            return 1


class SqlAlchemyPurchaseOrderRepository(PurchaseOrderRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, po: PurchaseOrder) -> None:
        model = await self._session.get(PurchaseOrderModel, po.id.value)
        if model:
            model.status = po.status
            model.expected_delivery_date = po.expected_delivery_date
            model.rejection_reason = po.rejection_reason
            model.finance_comments = po.finance_comments
            model.additional_charges = po.additional_charges
            model.department = getattr(po, 'department', None)
            model.procurement_officer = getattr(po, 'procurement_officer', None)
            model.delivery_warehouse = getattr(po, 'delivery_warehouse', None)
            model.delivery_address = getattr(po, 'delivery_address', None)
            await self._session.execute(
                delete(PurchaseOrderLineModel).where(PurchaseOrderLineModel.purchase_order_id == po.id.value)
            )
            await self._session.execute(
                delete(PurchaseOrderApprovalLogModel).where(PurchaseOrderApprovalLogModel.purchase_order_id == po.id.value)
            )
        else:
            model = PurchaseOrderModel(
                id=po.id.value,
                po_number=po.po_number,
                quotation_id=po.quotation_id.value if po.quotation_id else None,
                supplier_id=po.supplier_id.value,
                status=po.status,
                po_date=po.po_date,
                expected_delivery_date=po.expected_delivery_date,
                created_at=po.created_at,
                rejection_reason=po.rejection_reason,
                finance_comments=po.finance_comments,
                additional_charges=po.additional_charges,
                department=getattr(po, 'department', None),
                procurement_officer=getattr(po, 'procurement_officer', None),
                delivery_warehouse=getattr(po, 'delivery_warehouse', None),
                delivery_address=getattr(po, 'delivery_address', None),
            )
            self._session.add(model)

        for line in po.lines:
            model.lines.append(
                PurchaseOrderLineModel(
                    item_code=line.item_code,
                    ordered_quantity=line.ordered_quantity,
                    unit_price=line.unit_price,
                    material_name=line.material_name,
                    category=line.category,
                    uom=line.uom,
                    discount=line.discount,
                    tax=line.tax,
                )
            )

        for log in po.logs:
            model.logs.append(
                PurchaseOrderApprovalLogModel(
                    id=uuid.UUID(log.id),
                    purchase_order_id=po.id.value,
                    status=log.status,
                    actor=log.actor,
                    action_date=log.action_date,
                    reason=log.reason,
                    comments=log.comments,
                )
            )

        for event in po.domain_events:
            self._session.add(to_outbox_row("PurchaseOrder", str(po.id), event))
        await self._session.flush()

    async def get_by_id(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrder]:
        result = await self._session.execute(
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.lines), selectinload(PurchaseOrderModel.logs))
            .where(PurchaseOrderModel.id == po_id.value)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._to_aggregate(model)

    async def get_by_number(self, po_number: str) -> Optional[PurchaseOrder]:
        result = await self._session.execute(
            select(PurchaseOrderModel)
            .options(selectinload(PurchaseOrderModel.lines), selectinload(PurchaseOrderModel.logs))
            .where(PurchaseOrderModel.po_number == po_number)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return self._to_aggregate(model)

    async def list_all(self) -> List[PurchaseOrder]:
        result = await self._session.execute(
            select(PurchaseOrderModel).options(selectinload(PurchaseOrderModel.lines), selectinload(PurchaseOrderModel.logs))
        )
        models = result.scalars().all()
        return [self._to_aggregate(model) for model in models]

    def _to_aggregate(self, model: PurchaseOrderModel) -> PurchaseOrder:
        from app.modules.procurement.domain.purchase_order import PurchaseOrderApprovalLog
        po = PurchaseOrder(
            id=PurchaseOrderId.of(model.id),
            po_number=model.po_number,
            quotation_id=QuotationId.of(model.quotation_id) if model.quotation_id else None,
            supplier_id=SupplierId.of(model.supplier_id),
            status=model.status,
            lines=[
                PurchaseOrderLine(
                    item_code=l.item_code,
                    ordered_quantity=l.ordered_quantity,
                    unit_price=l.unit_price,
                    material_name=getattr(l, 'material_name', None),
                    category=getattr(l, 'category', None),
                    uom=getattr(l, 'uom', 'PCS'),
                    discount=getattr(l, 'discount', Decimal("0.0")) or Decimal("0.0"),
                    tax=getattr(l, 'tax', Decimal("0.0")) or Decimal("0.0"),
                )
                for l in model.lines
            ],
            po_date=model.po_date,
            expected_delivery_date=model.expected_delivery_date,
            created_at=model.created_at,
            rejection_reason=model.rejection_reason,
            finance_comments=model.finance_comments,
            logs=[
                PurchaseOrderApprovalLog(
                    id=str(log.id),
                    status=log.status,
                    actor=log.actor,
                    action_date=log.action_date,
                    reason=log.reason,
                    comments=log.comments,
                )
                for log in model.logs
            ] if model.logs else [],
            additional_charges=getattr(model, 'additional_charges', Decimal("0.0")) or Decimal("0.0"),
        )
        po.department = getattr(model, 'department', None)
        po.procurement_officer = getattr(model, 'procurement_officer', None)
        po.delivery_warehouse = getattr(model, 'delivery_warehouse', None)
        po.delivery_address = getattr(model, 'delivery_address', None)
        return po

    async def get_next_sequence(self, year: int) -> int:
        from sqlalchemy import func
        # Find the highest sequence number for the given year
        # po_number format: PO-YYYY-XXXX
        pattern = f"PO-{year}-%"
        result = await self._session.execute(
            select(func.max(PurchaseOrderModel.po_number)).where(PurchaseOrderModel.po_number.like(pattern))
        )
        max_po = result.scalar_one_or_none()
        if not max_po:
            return 1
        try:
            # Extract XXXX and increment
            parts = max_po.split("-")
            return int(parts[2]) + 1
        except (IndexError, ValueError):
            return 1


class SqlAlchemyAsnRepository(AsnRepository):
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, asn: ASN) -> None:
        model = await self._session.get(AsnModel, asn.id.value)
        if model:
            model.status = asn.status
            await self._session.execute(delete(AsnLineModel).where(AsnLineModel.asn_id == asn.id.value))
        else:
            model = AsnModel(
                id=asn.id.value,
                po_id=asn.po_id.value,
                asn_number=asn.asn_number,
                status=asn.status,
                vehicle_number=asn.vehicle_number,
                driver_name=asn.driver_name,
                driver_contact=asn.driver_contact,
                expected_arrival_at=asn.expected_arrival_at,
                shipment_date=asn.shipment_date,
                created_at=asn.created_at,
            )
            self._session.add(model)

        for line in asn.lines:
            model.lines.append(AsnLineModel(item_code=line.item_code, shipped_quantity=line.shipped_quantity))

        for event in asn.domain_events:
            self._session.add(to_outbox_row("ASN", str(asn.id), event))
        await self._session.flush()

    async def get_by_id(self, asn_id: AsnId) -> Optional[ASN]:
        result = await self._session.execute(
            select(AsnModel).options(selectinload(AsnModel.lines)).where(AsnModel.id == asn_id.value)
        )
        model = result.scalar_one_or_none()
        if not model:
            return None
        return ASN(
            id=AsnId.of(model.id),
            po_id=PurchaseOrderId.of(model.po_id),
            asn_number=model.asn_number,
            status=model.status,
            lines=[AsnLine(item_code=l.item_code, shipped_quantity=l.shipped_quantity) for l in model.lines],
            vehicle_number=model.vehicle_number,
            driver_name=model.driver_name,
            driver_contact=model.driver_contact,
            expected_arrival_at=model.expected_arrival_at,
            shipment_date=getattr(model, 'shipment_date', None),
            created_at=model.created_at,
        )

    async def list_all(self) -> List[ASN]:
        result = await self._session.execute(
            select(AsnModel).options(selectinload(AsnModel.lines))
        )
        models = result.scalars().all()
        return [
            ASN(
                id=AsnId.of(model.id),
                po_id=PurchaseOrderId.of(model.po_id),
                asn_number=model.asn_number,
                status=model.status,
                lines=[AsnLine(item_code=l.item_code, shipped_quantity=l.shipped_quantity) for l in model.lines],
                vehicle_number=model.vehicle_number,
                driver_name=model.driver_name,
                driver_contact=model.driver_contact,
                expected_arrival_at=model.expected_arrival_at,
                created_at=model.created_at,
            )
            for model in models
        ]

    async def get_next_sequence(self, year: int) -> int:
        from sqlalchemy import func
        # Find the highest sequence number for the given year
        # asn_number format: ASN-YYYY-XXXX
        pattern = f"ASN-{year}-%"
        result = await self._session.execute(
            select(func.max(AsnModel.asn_number)).where(AsnModel.asn_number.like(pattern))
        )
        max_asn = result.scalar_one_or_none()
        if not max_asn:
            return 1
        try:
            # Extract XXXX and increment
            parts = max_asn.split("-")
            return int(parts[2]) + 1
        except (IndexError, ValueError):
            return 1
