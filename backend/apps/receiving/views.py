from rest_framework import viewsets
from .models import GRN, GRNLine
from .serializers import GRNSerializer, GRNLineSerializer

class GRNViewSet(viewsets.ModelViewSet):
    queryset = GRN.objects.all()
    serializer_class = GRNSerializer

class GRNLineViewSet(viewsets.ModelViewSet):
    queryset = GRNLine.objects.all()
    serializer_class = GRNLineSerializer
