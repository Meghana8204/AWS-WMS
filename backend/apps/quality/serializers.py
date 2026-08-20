from rest_framework import serializers
from .models import QualityInspection, NonConformanceReport

class NonConformanceReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = NonConformanceReport
        fields = "__all__"

class QualityInspectionSerializer(serializers.ModelSerializer):
    ncr = NonConformanceReportSerializer(read_only=True)
    item_name = serializers.ReadOnlyField(source="item.item_name")
    inspector_name = serializers.ReadOnlyField(source="inspector.username")

    class Meta:
        model = QualityInspection
        fields = "__all__"
