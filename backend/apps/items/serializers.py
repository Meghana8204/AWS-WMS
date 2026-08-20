from rest_framework import serializers
from .models import Item

class ItemSerializer(serializers.ModelSerializer):
    category_name = serializers.ReadOnlyField(source="category.name")
    uom_name = serializers.ReadOnlyField(source="uom.name")

    class Meta:
        model = Item
        fields = "__all__"
