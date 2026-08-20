from rest_framework import viewsets
from .models import Warehouse, Zone, Bin
from .serializers import WarehouseSerializer, ZoneSerializer, BinSerializer

class WarehouseViewSet(viewsets.ModelViewSet):
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer

class ZoneViewSet(viewsets.ModelViewSet):
    queryset = Zone.objects.all()
    serializer_class = ZoneSerializer

class BinViewSet(viewsets.ModelViewSet):
    queryset = Bin.objects.all()
    serializer_class = BinSerializer
