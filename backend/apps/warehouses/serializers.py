from rest_framework import serializers
from .models import Warehouse, Zone, Bin

class BinSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bin
        fields = "__all__"

class ZoneSerializer(serializers.ModelSerializer):
    bins = BinSerializer(many=True, read_only=True)
    class Meta:
        model = Zone
        fields = "__all__"

class WarehouseSerializer(serializers.ModelSerializer):
    zones = ZoneSerializer(many=True, read_only=True)
    class Meta:
        model = Warehouse
        fields = "__all__"
