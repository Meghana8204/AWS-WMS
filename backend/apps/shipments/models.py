from django.db import models
from common.models import BaseModel

class Shipment(BaseModel):
    STATUS_CHOICES = (
        ("PREPARING", "Preparing"),
        ("DISPATCHED", "Dispatched"),
        ("IN_TRANSIT", "In Transit"),
        ("DELAYED", "Delayed"),
        ("ARRIVING", "Arriving"),
        ("ARRIVED", "Arrived"),
        ("DELIVERED", "Delivered"),
    )

    shipment_number = models.CharField(max_length=50, unique=True, editable=False)
    asn = models.ForeignKey("asn.ASN", on_delete=models.CASCADE, related_name="shipments")
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.PROTECT)

    carrier = models.CharField(max_length=200)
    vehicle_number = models.CharField(max_length=100)

    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)

    dispatch_date = models.DateTimeField()
    estimated_arrival = models.DateTimeField()
    actual_arrival = models.DateTimeField(null=True, blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PREPARING")

    def save(self, *args, **kwargs):
        if not self.shipment_number:
            import uuid
            self.shipment_number = f"SHP-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.shipment_number} - {self.status}"
