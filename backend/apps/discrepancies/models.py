from django.db import models
from common.models import BaseModel

class Discrepancy(BaseModel):
    TYPES = (
        ("QUANTITY", "Quantity Mismatch"),
        ("DAMAGE", "Physical Damage"),
        ("WRONG_ITEM", "Wrong Item Delivered"),
        ("DOCUMENT", "Documentation Error"),
        ("OTHER", "Other"),
    )

    STATUS_CHOICES = (
        ("OPEN", "Open"),
        ("INVESTIGATION", "In Investigation"),
        ("RESOLVED", "Resolved"),
        ("CLOSED", "Closed"),
    )

    discrepancy_number = models.CharField(max_length=50, unique=True, editable=False)
    type = models.CharField(max_length=20, choices=TYPES)
    severity = models.CharField(max_length=20, default="MEDIUM")
    description = models.TextField()

    purchase_order = models.ForeignKey("purchase_orders.PurchaseOrder", on_delete=models.CASCADE)
    grn = models.ForeignKey("receiving.GRN", on_delete=models.CASCADE, null=True, blank=True)
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.PROTECT)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="OPEN")
    resolution = models.TextField(blank=True)

    assigned_to = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_discrepancies")

    def save(self, *args, **kwargs):
        if not self.discrepancy_number:
            import uuid
            self.discrepancy_number = f"DISC-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.discrepancy_number
