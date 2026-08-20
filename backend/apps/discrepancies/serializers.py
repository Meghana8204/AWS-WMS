from rest_framework import serializers
from .models import Discrepancy

class DiscrepancySerializer(serializers.ModelSerializer):
    supplier_name = serializers.ReadOnlyField(source="supplier.supplier_name")
    po_number = serializers.ReadOnlyField(source="purchase_order.po_number")
    grn_number = serializers.ReadOnlyField(source="grn.grn_number")
    assigned_to_name = serializers.ReadOnlyField(source="assigned_to.username")

    class Meta:
        model = Discrepancy
        fields = "__all__"
