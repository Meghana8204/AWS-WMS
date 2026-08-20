from rest_framework import viewsets
from .models import TraceabilityRecord, InventoryBalance
from .serializers import TraceabilityRecordSerializer, InventoryBalanceSerializer

class TraceabilityRecordViewSet(viewsets.ModelViewSet):
    queryset = TraceabilityRecord.objects.all()
    serializer_class = TraceabilityRecordSerializer

class InventoryBalanceViewSet(viewsets.ModelViewSet):
    queryset = InventoryBalance.objects.all()
    serializer_class = InventoryBalanceSerializer
