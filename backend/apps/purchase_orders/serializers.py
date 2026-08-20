from rest_framework import serializers
from .models import PurchaseOrder, POLineItem, POVersion, POApprovalLog

class POLineItemSerializer(serializers.ModelSerializer):
    item_name = serializers.ReadOnlyField(source="item.item_name")
    uom_code = serializers.ReadOnlyField(source="uom.code")

    class Meta:
        model = POLineItem
        fields = "__all__"

class PurchaseOrderSerializer(serializers.ModelSerializer):
    lines = POLineItemSerializer(many=True, read_only=True)
    supplier_name = serializers.ReadOnlyField(source="supplier.supplier_name")
    warehouse_name = serializers.ReadOnlyField(source="warehouse.warehouse_name")
    company_name = serializers.ReadOnlyField(source="company.company_name")
    currency_symbol = serializers.ReadOnlyField(source="currency.symbol")

    class Meta:
        model = PurchaseOrder
        fields = "__all__"

class POVersionSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.ReadOnlyField(source="changed_by.username")
    class Meta:
        model = POVersion
        fields = "__all__"

class POApprovalLogSerializer(serializers.ModelSerializer):
    approver_name = serializers.ReadOnlyField(source="approver.username")
    class Meta:
        model = POApprovalLog
        fields = "__all__"
