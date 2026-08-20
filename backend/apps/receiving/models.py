from django.db import models
from common.models import BaseModel

class GRN(BaseModel):
    STATUS_CHOICES = (
        ("DRAFT", "Draft"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    )

    grn_number = models.CharField(max_length=50, unique=True, editable=False)
    purchase_order = models.ForeignKey("purchase_orders.PurchaseOrder", on_delete=models.PROTECT, related_name="grns")
    asn = models.ForeignKey("asn.ASN", on_delete=models.SET_NULL, null=True, blank=True)
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("warehouses.Warehouse", on_delete=models.PROTECT)

    receipt_date = models.DateTimeField(auto_now_add=True)
    receiver = models.ForeignKey("accounts.User", on_delete=models.PROTECT)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT")

    def save(self, *args, **kwargs):
        if not self.grn_number:
            import uuid
            self.grn_number = f"GRN-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.grn_number

class GRNLine(BaseModel):
    grn = models.ForeignKey(GRN, on_delete=models.CASCADE, related_name="lines")
    po_line = models.ForeignKey("purchase_orders.POLineItem", on_delete=models.PROTECT)
    item = models.ForeignKey("items.Item", on_delete=models.PROTECT)

    ordered_quantity = models.DecimalField(max_digits=18, decimal_places=4)
    received_quantity = models.DecimalField(max_digits=18, decimal_places=4)
    accepted_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    rejected_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    def __str__(self):
        return f"{self.grn.grn_number} - {self.item.item_name}"
