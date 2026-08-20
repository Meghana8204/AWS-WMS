from rest_framework import viewsets
from .models import Shipment
from .serializers import ShipmentSerializer

class ShipmentViewSet(viewsets.ModelViewSet):
    queryset = Shipment.objects.all()
    serializer_class = ShipmentSerializer
