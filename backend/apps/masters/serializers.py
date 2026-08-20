from rest_framework import serializers
from .models import Category, UOM, Currency, PaymentTerm

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = "__all__"

class UOMSerializer(serializers.ModelSerializer):
    class Meta:
        model = UOM
        fields = "__all__"

class CurrencySerializer(serializers.ModelSerializer):
    class Meta:
        model = Currency
        fields = "__all__"

class PaymentTermSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentTerm
        fields = "__all__"
