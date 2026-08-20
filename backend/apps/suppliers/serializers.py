from rest_framework import serializers
from .models import (
    Supplier, SupplierContact, SupplierAddress,
    SupplierCategoryMapping, SupplierDocument, SupplierQualification
)

class SupplierContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierContact
        fields = "__all__"

class SupplierAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierAddress
        fields = "__all__"

class SupplierCategoryMappingSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source="category.name")
    class Meta:
        model = SupplierCategoryMapping
        fields = "__all__"

class SupplierDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierDocument
        fields = "__all__"

class SupplierQualificationSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.ReadOnlyField(source="performed_by.username")
    class Meta:
        model = SupplierQualification
        fields = "__all__"

class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, read_only=True)
    addresses = SupplierAddressSerializer(many=True, read_only=True)
    category_mappings = SupplierCategoryMappingSerializer(many=True, read_only=True)
    documents = SupplierDocumentSerializer(many=True, read_only=True)
    qualification_history = SupplierQualificationSerializer(many=True, read_only=True)

    class Meta:
        model = Supplier
        fields = "__all__"
