from django.db import models
from common.models import BaseModel

class GateEntry(BaseModel):
    STATUS_CHOICES = (
        ("EXPECTED", "Expected"),
        ("ARRIVED", "Arrived"),
        ("SAFETY_CHECK", "In Safety Check"),
        ("IN_QUEUE", "In Queue"),
        ("UNLOADING", "Unloading"),
        ("COMPLETED", "Completed"),
        ("CANCELLED", "Cancelled"),
    )

    gate_entry_number = models.CharField(max_length=50, unique=True, editable=False)
    vehicle_number = models.CharField(max_length=100)
    driver_name = models.CharField(max_length=200)
    driver_contact = models.CharField(max_length=50, blank=True)

    carrier = models.CharField(max_length=200, blank=True)
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.PROTECT)
    purchase_order = models.ForeignKey("purchase_orders.PurchaseOrder", on_delete=models.SET_NULL, null=True, blank=True)
    asn = models.ForeignKey("asn.ASN", on_delete=models.SET_NULL, null=True, blank=True)

    arrival_time = models.DateTimeField(auto_now_add=True)
    scheduled_slot = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="ARRIVED")

    def save(self, *args, **kwargs):
        if not self.gate_entry_number:
            import uuid
            self.gate_entry_number = f"GE-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.gate_entry_number} - {self.vehicle_number}"
