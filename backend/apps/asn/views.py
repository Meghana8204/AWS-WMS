from rest_framework import viewsets
from .models import ASN, ASNLine
from .serializers import ASNSerializer, ASNLineSerializer

class ASNViewSet(viewsets.ModelViewSet):
    queryset = ASN.objects.all()
    serializer_class = ASNSerializer

class ASNLineViewSet(viewsets.ModelViewSet):
    queryset = ASNLine.objects.all()
    serializer_class = ASNLineSerializer
