from rest_framework import viewsets
from .models import GateEntry
from .serializers import GateEntrySerializer

class GateEntryViewSet(viewsets.ModelViewSet):
    queryset = GateEntry.objects.all()
    serializer_class = GateEntrySerializer
