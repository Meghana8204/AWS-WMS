from rest_framework import serializers
from .models import GRN, GRNLine

class GRNLineSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source="item.item_name")

    class Meta:
        model = GRNLine
        fields = "__all__"

class GRNSerializer(serializers.ModelSerializer):
    lines = GRNLineSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source="supplier.supplier_name")
    po_number = serializers.ReadOnlyField(source="purchase_order.po_number")
    receiver_name = serializers.ReadOnlyField(source="receiver.username")

    class Meta:
        model = GRN
        fields = "__all__"
