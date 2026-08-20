from rest_framework import viewsets
from .models import Category, UOM, Currency, PaymentTerm
from .serializers import (
    CategorySerializer, UOMSerializer, CurrencySerializer, PaymentTermSerializer
)

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class UOMViewSet(viewsets.ModelViewSet):
    queryset = UOM.objects.all()
    serializer_class = UOMSerializer

class CurrencyViewSet(viewsets.ModelViewSet):
    queryset = Currency.objects.all()
    serializer_class = CurrencySerializer

class PaymentTermViewSet(viewsets.ModelViewSet):
    queryset = PaymentTerm.objects.all()
    serializer_class = PaymentTermSerializer
