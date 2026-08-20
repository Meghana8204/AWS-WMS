from django.db import models
from common.models import BaseModel

class TraceabilityRecord(BaseModel):
    item = models.ForeignKey("items.Item", on_delete=models.PROTECT)
    grn = models.ForeignKey("receiving.GRN", on_delete=models.CASCADE, related_name="traceability_records")

    serial_number = models.CharField(max_length=100, blank=True, null=True)
    batch_number = models.CharField(max_length=100, blank=True, null=True)

    manufacture_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)

    warehouse = models.ForeignKey("warehouses.Warehouse", on_delete=models.PROTECT)
    location = models.ForeignKey("warehouses.Bin", on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        unique_together = ("item", "serial_number") # Prevent duplicate serial numbers per item

    def __str__(self):
        return f"{self.item.item_name} - {self.serial_number or self.batch_number}"

class InventoryBalance(BaseModel):
    item = models.ForeignKey("items.Item", on_delete=models.PROTECT)
    warehouse = models.ForeignKey("warehouses.Warehouse", on_delete=models.PROTECT)

    total_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    available_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    on_hold_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)
    reserved_quantity = models.DecimalField(max_digits=18, decimal_places=4, default=0)

    class Meta:
        unique_together = ("item", "warehouse")
