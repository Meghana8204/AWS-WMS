from rest_framework import serializers
from .models import TraceabilityRecord, InventoryBalance

class TraceabilityRecordSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source="item.item_name")

    class Meta:
        model = TraceabilityRecord
        fields = "__all__"

class InventoryBalanceSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source="item.item_name")
    item_code = serializers.ReadOnlyField(source="item.item_code")

    class Meta:
        model = InventoryBalance
        fields = "__all__"
