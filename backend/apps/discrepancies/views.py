from rest_framework import viewsets
from .models import Discrepancy
from .serializers import DiscrepancySerializer

class DiscrepancyViewSet(viewsets.ModelViewSet):
    queryset = Discrepancy.objects.all()
    serializer_class = DiscrepancySerializer
