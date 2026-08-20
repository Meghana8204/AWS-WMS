from rest_framework import serializers
from .models import GateEntry

class GateEntrySerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source="supplier.supplier_name")
    po_number = serializers.ReadOnlyField(source="purchase_order.po_number")
    asn_number = serializers.ReadOnlyField(source="asn.asn_number")

    class Meta:
        model = GateEntry
        fields = "__all__"
