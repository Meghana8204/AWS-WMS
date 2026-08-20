from rest_framework import serializers
from .models import Document

class DocumentSerializer(serializers.ModelSerializer):
    validated_by_name = serializers.ReadOnlyField(source="validated_by.username")

    class Meta:
        model = Document
        fields = "__all__"
