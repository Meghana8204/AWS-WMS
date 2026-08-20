from rest_framework import viewsets
from .models import QualityInspection, NonConformanceReport
from .serializers import QualityInspectionSerializer, NonConformanceReportSerializer

class QualityInspectionViewSet(viewsets.ModelViewSet):
    queryset = QualityInspection.objects.all()
    serializer_class = QualityInspectionSerializer

class NonConformanceReportViewSet(viewsets.ModelViewSet):
    queryset = NonConformanceReport.objects.all()
    serializer_class = NonConformanceReportSerializer
