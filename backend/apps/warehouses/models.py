from django.db import models
from common.models import BaseModel
from organization.models import Company

class Warehouse(BaseModel):
    warehouse_code = models.CharField(max_length=20, unique=True)
    warehouse_name = models.CharField(max_length=200)
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name="warehouses")
    address = models.TextField()
    country = models.CharField(max_length=100)
    timezone = models.CharField(max_length=50, default="UTC")
    status = models.CharField(max_length=20, default="ACTIVE")

    def __str__(self):
        return f"{self.warehouse_name} ({self.warehouse_code})"

class Zone(BaseModel):
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE, related_name="zones")
    zone_code = models.CharField(max_length=20)
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.warehouse.warehouse_code} - {self.zone_code}"

class Bin(BaseModel):
    zone = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name="bins")
    bin_code = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.zone.zone_code} - {self.bin_code}"
