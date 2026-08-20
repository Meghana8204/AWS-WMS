from django.db import models
from django.conf import settings
from common.models import BaseModel

class PurchaseOrder(BaseModel):
    PO_TYPES = (
        ("STANDARD", "Standard PO"),
        ("BLANKET", "Blanket PO"),
        ("FRAMEWORK", "Framework Agreement"),
    )

    WORKFLOW_STATUS = (
        ("DRAFT", "Draft"),
        ("SUBMITTED", "Submitted for Approval"),
        ("UNDER_APPROVAL", "Under Approval"),
        ("APPROVED", "Approved"),
        ("REJECTED", "Rejected"),
        ("SENT", "Sent to Supplier"),
        ("ACKNOWLEDGED", "Acknowledged by Supplier"),
        ("REVISION_REQUIRED", "Revision Required"),
        ("CANCELLED", "Cancelled"),
    )

    BUSINESS_STATUS = (
        ("OPEN", "Open"),
        ("PARTIALLY_RECEIVED", "Partially Received"),
        ("FULLY_RECEIVED", "Fully Received"),
        ("CLOSED", "Closed"),
    )

    po_number = models.CharField(max_length=50, unique=True, editable=False)
    po_date = models.DateField(auto_now_add=True)
    po_type = models.CharField(max_length=20, choices=PO_TYPES, default="STANDARD")

    company = models.ForeignKey("organization.Company", on_delete=models.PROTECT, related_name="purchase_orders")
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.PROTECT, related_name="purchase_orders")
    warehouse = models.ForeignKey("warehouses.Warehouse", on_delete=models.PROTECT, related_name="purchase_orders")

    currency = models.ForeignKey("masters.Currency", on_delete=models.PROTECT, related_name="po_currency")
    reporting_currency = models.ForeignKey("masters.Currency", on_delete=models.PROTECT, related_name="po_reporting_currency")

    payment_terms = models.ForeignKey("masters.PaymentTerm", on_delete=models.PROTECT, related_name="purchase_orders")
    expected_delivery_date = models.DateField()

    status = models.CharField(max_length=30, choices=WORKFLOW_STATUS, default="DRAFT")
    receipt_status = models.CharField(max_length=30, choices=BUSINESS_STATUS, default="OPEN")

    total_amount = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    discount_amount = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    net_amount = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    version = models.IntegerField(default=1)
    is_amended = models.BooleanField(default=False)

    notes = models.TextField(blank=True)

    # Transmission details
    transmission_date = models.DateTimeField(null=True, blank=True)
    acknowledged_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.po_number:
            last_po = PurchaseOrder.objects.order_by("-created_at").first()
            if not last_po:
                self.po_number = "PO-000001"
            else:
                try:
                    last_id = int(last_po.po_number.split("-")[1])
                    self.po_number = f"PO-{str(last_id + 1).zfill(6)}"
                except (IndexError, ValueError):
                    import uuid
                    self.po_number = f"PO-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.po_number} - {self.supplier.supplier_name}"

class POLineItem(BaseModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="lines")
    item = models.ForeignKey("items.Item", on_delete=models.PROTECT, related_name="po_lines")
    description = models.TextField(blank=True)

    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    uom = models.ForeignKey("masters.UOM", on_delete=models.PROTECT, related_name="po_lines")

    unit_price = models.DecimalField(max_digits=18, decimal_places=4)
    tax_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)

    line_total = models.DecimalField(max_digits=18, decimal_places=4)
    expected_delivery_date = models.DateField()

    # Tracking
    received_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    accepted_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    rejected_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    def __str__(self):
        return f"{self.purchase_order.po_number} - {self.item.item_name}"

class POVersion(BaseModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="versions")
    version_number = models.IntegerField()
    snapshot_data = models.JSONField() # Complete PO snapshot
    change_reason = models.TextField()
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)

    class Meta:
        unique_together = ("purchase_order", "version_number")

class POApprovalLog(BaseModel):
    purchase_order = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name="approval_logs")
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    action = models.CharField(max_length=20) # APPROVE, REJECT, SEND_BACK
    comments = models.TextField(blank=True)
    old_status = models.CharField(max_length=30)
    new_status = models.CharField(max_length=30)

    # Version at which this approval happened
    version = models.IntegerField()
