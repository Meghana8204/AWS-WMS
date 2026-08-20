from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import PurchaseOrder, POLineItem, POVersion, POApprovalLog
from .serializers import (
    PurchaseOrderSerializer, POLineItemSerializer,
    POVersionSerializer, POApprovalLogSerializer
)

class PurchaseOrderViewSet(viewsets.ModelViewSet):
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer

    def get_queryset(self):
        # Filter based on role if needed
        return super().get_queryset()

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        # Implementation for nested lines creation
        data = request.data
        lines_data = data.pop("lines", [])

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        po = serializer.save(created_by=request.user)

        # Create lines
        for line in lines_data:
            item_id = line.pop("item", None)
            uom_id = line.pop("uom", None)
            POLineItem.objects.create(
                purchase_order=po,
                created_by=request.user,
                item_id=item_id,
                uom_id=uom_id,
                line_total=0,
                **line
            )

        # Recalculate totals
        self._update_po_totals(po)

        return Response(PurchaseOrderSerializer(po).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def submit(self, request, pk=None):
        po = self.get_object()
        if po.status != "DRAFT":
            return Response({"error": "Only DRAFT orders can be submitted."}, status=status.HTTP_400_BAD_REQUEST)

        po.status = "SUBMITTED"
        po.save()

        POApprovalLog.objects.create(
            purchase_order=po,
            approver=request.user,
            action="SUBMIT",
            old_status="DRAFT",
            new_status="SUBMITTED",
            version=po.version,
            performed_by=request.user
        )

        return Response({"message": "Order submitted for approval."})

    @action(detail=True, methods=["post"])
    @transaction.atomic
    def approve(self, request, pk=None):
        po = self.get_object()
        # In a real system, we'd check if request.user is the current authorized approver
        old_status = po.status
        po.status = "APPROVED"
        po.save()

        POApprovalLog.objects.create(
            purchase_order=po,
            approver=request.user,
            action="APPROVE",
            old_status=old_status,
            new_status="APPROVED",
            version=po.version
        )

        return Response({"message": "Order approved."})

    @action(detail=True, methods=["post"])
    def transmit(self, request, pk=None):
        po = self.get_object()
        if po.status != "APPROVED":
            return Response({"error": "Only APPROVED orders can be transmitted."}, status=status.HTTP_400_BAD_REQUEST)

        po.status = "SENT"
        po.transmission_date = timezone.now()
        po.save()
        return Response({"message": "Order transmitted to supplier."})

    @action(detail=True, methods=["post"])
    def acknowledge(self, request, pk=None):
        po = self.get_object()
        if po.status != "SENT":
            return Response({"error": "Only SENT orders can be acknowledged."}, status=status.HTTP_400_BAD_REQUEST)

        po.status = "ACKNOWLEDGED"
        po.acknowledged_at = timezone.now()
        po.save()
        return Response({"message": "Order acknowledged by supplier."})

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        po = self.get_object()

        # If PO is already approved/sent, any update requires versioning
        if po.status in ["APPROVED", "SENT", "ACKNOWLEDGED"]:
            change_reason = request.data.get("change_reason", "Manual amendment")
            from .services import POVersioningService
            POVersioningService.create_version(po, change_reason, request.user)

            # Reset status to UNDER_APPROVAL or REVISION_REQUIRED
            po.status = "UNDER_APPROVAL"
            po.save()

        return super().update(request, *args, **kwargs)

    def _update_po_totals(self, po):
        lines = po.lines.all()
        total = 0
        tax = 0
        discount = 0

        for line in lines:
            # Line total calculation logic
            subtotal = line.quantity * line.unit_price
            line_tax = subtotal * (line.tax_percentage / 100)
            line_discount = subtotal * (line.discount_percentage / 100)
            line.line_total = subtotal + line_tax - line_discount
            line.save()

            total += subtotal
            tax += line_tax
            discount += line_discount

        po.total_amount = total
        po.tax_amount = tax
        po.discount_amount = discount
        po.net_amount = total + tax - discount
        po.save()

class POLineItemViewSet(viewsets.ModelViewSet):
    queryset = POLineItem.objects.all()
    serializer_class = POLineItemSerializer
