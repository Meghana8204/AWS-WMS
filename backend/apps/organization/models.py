from django.db import models
from common.models import BaseModel

class Company(BaseModel):
    company_code = models.CharField(max_length=20, unique=True)
    company_name = models.CharField(max_length=200)
    legal_name = models.CharField(max_length=250)
    tax_id = models.CharField(max_length=50, blank=True)
    country = models.CharField(max_length=100)
    base_currency = models.CharField(max_length=10, default="USD")
    timezone = models.CharField(max_length=50, default="UTC")
    status = models.CharField(max_length=20, default="ACTIVE")

    def __str__(self):
        return f"{self.company_name} ({self.company_code})"
