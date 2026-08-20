from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from suppliers.models import Supplier
from purchase_orders.models import PurchaseOrder
from asn.models import ASN

class ProcurementDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stats = {
            "active_suppliers": Supplier.objects.filter(status="ACTIVE").count(),
            "pending_suppliers": Supplier.objects.filter(status="UNDER_REVIEW").count(),
            "open_pos": PurchaseOrder.objects.filter(status="APPROVED", receipt_status="OPEN").count(),
            "pending_po_approvals": PurchaseOrder.objects.filter(status="SUBMITTED").count(),
            "partially_received_pos": PurchaseOrder.objects.filter(receipt_status="PARTIALLY_RECEIVED").count(),
            "fully_received_pos": PurchaseOrder.objects.filter(receipt_status="FULLY_RECEIVED").count(),
            "planned_arrivals": ASN.objects.filter(status__in=["SUBMITTED", "VALIDATED", "DISPATCHED", "IN_TRANSIT"]).count(),
        }

        return Response({
            "success": True,
            "data": stats
        })
