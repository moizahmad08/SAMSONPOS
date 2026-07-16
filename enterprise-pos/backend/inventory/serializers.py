from rest_framework import serializers
from .models import Category, Product, Sale, SaleItem

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = '__all__'

class ProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = Product
        fields = '__all__'

class SaleItemSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.name', read_only=True)
    
    class Meta:
        model = SaleItem
        fields = ['id', 'product', 'product_name', 'quantity', 'price_at_sale']

class SaleSerializer(serializers.ModelSerializer):
    items = SaleItemSerializer(many=True, read_only=True) # Pulls in the items for each sale automatically
    
    class Meta:
        model = Sale
        fields = ['id', 'total_amount', 'tax_amount', 'payment_method', 'amount_tendered', 'change_due', 'status', 'created_at', 'items']