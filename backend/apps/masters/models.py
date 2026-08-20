from django.db import models
from common.models import BaseModel

class Category(BaseModel):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, default="ACTIVE")

    def __str__(self):
        return self.name

class UOM(BaseModel):
    code = models.CharField(max_length=20, unique=True)
    name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=10)

    def __str__(self):
        return f"{self.name} ({self.symbol})"

class Currency(BaseModel):
    code = models.CharField(max_length=10, unique=True) # e.g. USD, INR
    name = models.CharField(max_length=50)
    symbol = models.CharField(max_length=10)
    exchange_rate = models.DecimalField(max_digits=18, decimal_places=6, default=1.0)

    def __str__(self):
        return self.code

class PaymentTerm(BaseModel):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=100)
    days = models.IntegerField()
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name
