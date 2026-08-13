"""
Repository port protocol for the procurement application layer.
"""
from typing import Optional, Protocol, Sequence

from app.modules.procurement.domain.arrival_notification import ArrivalNotification
from app.modules.procurement.domain.finance_approval import FinanceApproval
from app.modules.procurement.domain.material_request import MaterialRequest
from app.modules.procurement.domain.purchase_order import PurchaseOrder
from app.modules.procurement.domain.rfq import RequestForQuotation
from app.modules.procurement.domain.supplier_asn import SupplierASN
from app.modules.procurement.domain.supplier_quotation import SupplierQuotation
from app.modules.procurement.domain.value_objects import PurchaseOrderId


class PurchaseOrderRepository(Protocol):
    async def save(self, purchase_order: PurchaseOrder) -> None:
        ...

    async def find_by_id(self, po_id: PurchaseOrderId) -> Optional[PurchaseOrder]:
        ...

    async def find_by_po_number(self, po_number: str) -> Optional[PurchaseOrder]:
        ...

    async def list_all(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Sequence[PurchaseOrder]:
        ...

    async def count(
        self,
        status: Optional[str] = None,
        supplier_id: Optional[str] = None,
        search_query: Optional[str] = None,
    ) -> int:
        ...


class MaterialRequestRepositoryProtocol(Protocol):
    async def save(self, request: MaterialRequest) -> MaterialRequest:
        ...

    async def get_by_id(self, request_id: str) -> Optional[MaterialRequest]:
        ...

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[MaterialRequest], int]:
        ...


class RFQRepositoryProtocol(Protocol):
    async def save(self, rfq: RequestForQuotation) -> RequestForQuotation:
        ...

    async def get_by_id(self, rfq_id: str) -> Optional[RequestForQuotation]:
        ...

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[RequestForQuotation], int]:
        ...


class QuotationRepositoryProtocol(Protocol):
    async def save(self, quotation: SupplierQuotation) -> SupplierQuotation:
        ...

    async def get_by_id(self, quotation_id: str) -> Optional[SupplierQuotation]:
        ...

    async def list_by_rfq(self, rfq_id: str) -> list[SupplierQuotation]:
        ...


class FinanceApprovalRepositoryProtocol(Protocol):
    async def save(self, approval: FinanceApproval) -> FinanceApproval:
        ...

    async def get_by_id(self, approval_id: str) -> Optional[FinanceApproval]:
        ...

    async def get_by_po_id(self, po_id: str) -> Optional[FinanceApproval]:
        ...

    async def list_all(
        self,
        status: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[FinanceApproval], int]:
        ...


class ASNRepositoryProtocol(Protocol):
    async def save(self, asn: SupplierASN) -> SupplierASN:
        ...

    async def get_by_id(self, asn_id: str) -> Optional[SupplierASN]:
        ...

    async def get_by_vehicle(self, vehicle_number: str) -> Optional[SupplierASN]:
        ...

    async def get_by_po_id(self, po_id: str) -> Optional[SupplierASN]:
        ...

    async def list_all(
        self,
        status: Optional[str] = None,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[SupplierASN], int]:
        ...


class ArrivalNotificationRepositoryProtocol(Protocol):
    async def save(self, notification: ArrivalNotification) -> ArrivalNotification:
        ...

    async def get_by_id(self, notification_id: str) -> Optional[ArrivalNotification]:
        ...

    async def list_all(
        self,
        warehouse_id: Optional[str] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> tuple[list[ArrivalNotification], int]:
        ...
