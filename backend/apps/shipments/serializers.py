from rest_framework import serializers
from .models import Shipment

class ShipmentSerializer(serializers.ModelSerializer):
    asn_number = serializers.ReadOnlyField(source="asn.asn_number")
    supplier_name = serializers.ReadOnlyField(source="supplier.supplier_name")

    class Meta:
        model = Shipment
        fields = "__all__"
