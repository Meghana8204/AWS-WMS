from rest_framework import serializers
from .models import ASN, ASNLine

class ASNLineSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source="item.item_name")
    uom_symbol = serializers.ReadOnlyField(source="uom.symbol")

    class Meta:
        model = ASNLine
        fields = "__all__"

class ASNSerializer(serializers.ModelSerializer):
    lines = ASNLineSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source="supplier.supplier_name")
    po_number = serializers.ReadOnlyField(source="purchase_order.po_number")

    class Meta:
        model = ASN
        fields = "__all__"
