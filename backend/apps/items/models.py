from django.db import models
from common.models import BaseModel

class Item(BaseModel):
    item_code = models.CharField(max_length=50, unique=True)
    item_name = models.CharField(max_length=200)
    description = models.TextField(blank=True)

    # Linked to Masters
    category = models.ForeignKey("masters.Category", on_delete=models.PROTECT, related_name="items")
    uom = models.ForeignKey("masters.UOM", on_delete=models.PROTECT, related_name="items")

    # Control Flags
    serial_controlled = models.BooleanField(default=False)
    batch_controlled = models.BooleanField(default=False)
    hazardous = models.BooleanField(default=False)
    high_value = models.BooleanField(default=False)
    safety_critical = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.item_name} ({self.item_code})"
