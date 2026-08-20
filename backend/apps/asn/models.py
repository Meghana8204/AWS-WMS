from django.db import models
from common.models import BaseModel

class ASN(BaseModel):
    STATUS_CHOICES = (
        ("DRAFT", "Draft"),
        ("SUBMITTED", "Submitted"),
        ("VALIDATED", "Validated"),
        ("DISPATCHED", "Dispatched"),
        ("IN_TRANSIT", "In Transit"),
        ("ARRIVED", "Arrived"),
        ("RECEIVED", "Received"),
        ("CANCELLED", "Cancelled"),
    )

    asn_number = models.CharField(max_length=50, unique=True, editable=False)
    purchase_order = models.ForeignKey("purchase_orders.PurchaseOrder", on_delete=models.CASCADE, related_name="asns")
    supplier = models.ForeignKey("suppliers.Supplier", on_delete=models.CASCADE, related_name="asns")

    expected_arrival_date = models.DateTimeField()
    carrier = models.CharField(max_length=200, blank=True)
    vehicle_number = models.CharField(max_length=100, blank=True)

    packing_configuration = models.TextField(blank=True)
    hazardous_material_declaration = models.BooleanField(default=False)

    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT")

    def save(self, *args, **kwargs):
        if not self.asn_number:
            import uuid
            self.asn_number = f"ASN-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.asn_number} ({self.purchase_order.po_number})"

class ASNLine(BaseModel):
    asn = models.ForeignKey(ASN, on_delete=models.CASCADE, related_name="lines")
    po_line = models.ForeignKey("purchase_orders.POLineItem", on_delete=models.CASCADE)
    item = models.ForeignKey("items.Item", on_delete=models.PROTECT)

    quantity = models.DecimalField(max_digits=18, decimal_places=4)
    uom = models.ForeignKey("masters.UOM", on_delete=models.PROTECT)

    package_count = models.IntegerField(default=1)

    def __str__(self):
        return f"{self.asn.asn_number} - {self.item.item_name}"
