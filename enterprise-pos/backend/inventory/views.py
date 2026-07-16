from rest_framework import viewsets, status
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django.db import transaction
from django.db.models import F, Sum
from .models import Category, Product, Sale, SaleItem
from .serializers import CategorySerializer, ProductSerializer, SaleSerializer

class CategoryViewSet(viewsets.ModelViewSet):
    queryset = Category.objects.all()
    serializer_class = CategorySerializer

class ProductViewSet(viewsets.ModelViewSet):
    queryset = Product.objects.all()
    serializer_class = ProductSerializer

class SaleViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only view for the transaction history."""
    queryset = Sale.objects.all().order_by('-created_at')
    serializer_class = SaleSerializer

@api_view(['POST'])
def process_checkout(request):
    """Handles sales transactions, creates a ledger entry, and deducts stock safely."""
    cart = request.data.get('cart', [])
    payment_method = request.data.get('payment_method', 'Cash')
    amount_tendered = float(request.data.get('amount_tendered', 0))
    tax_rate = float(request.data.get('tax_rate', 0.0))
    
    try:
        with transaction.atomic():
            subtotal = 0
            sale_items_data = []

            for item in cart:
                product = Product.objects.get(id=item['id'])
                qty = int(item['qty'])
                
                if product.stock_quantity < qty:
                    raise ValueError(f"Insufficient stock for {product.name}")
                
                product.stock_quantity -= qty
                product.save()
                
                line_total = float(product.selling_price) * qty
                subtotal += line_total
                
                sale_items_data.append({
                    'product': product,
                    'quantity': qty,
                    'price_at_sale': product.selling_price
                })

            tax_amount = subtotal * (tax_rate / 100)
            total_amount = subtotal + tax_amount
            change_due = amount_tendered - total_amount if payment_method == 'Cash' else 0

            sale = Sale.objects.create(
                total_amount=total_amount,
                tax_amount=tax_amount,
                payment_method=payment_method,
                amount_tendered=amount_tendered,
                change_due=change_due,
                status='Completed'
            )

            for item_data in sale_items_data:
                SaleItem.objects.create(
                    sale=sale,
                    product=item_data['product'],
                    quantity=item_data['quantity'],
                    price_at_sale=item_data['price_at_sale']
                )

        return Response({"message": "Sale completed successfully!", "sale_id": sale.id})
        
    except ValueError as e:
        return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({"error": "An unexpected error occurred."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def process_refund(request, sale_id):
    """Refunds a sale and returns items to stock."""
    try:
        with transaction.atomic():
            sale = Sale.objects.get(id=sale_id)
            
            if sale.status == 'Refunded':
                return Response({"error": "Sale is already refunded."}, status=status.HTTP_400_BAD_REQUEST)
                
            for item in sale.items.all():
                if item.product:
                    item.product.stock_quantity += item.quantity
                    item.product.save()
            
            sale.status = 'Refunded'
            sale.save()
            
            return Response({"message": f"Sale #{sale.id} successfully refunded."})
    except Sale.DoesNotExist:
        return Response({"error": "Sale not found."}, status=status.HTTP_404_NOT_FOUND)

@api_view(['GET'])
def get_reports(request):
    """Provides real metrics for the dashboard from the ledger."""
    total_products = Product.objects.count()
    low_stock_count = Product.objects.filter(stock_quantity__lte=F('reorder_level')).count()
    
    revenue_data = Sale.objects.filter(status='Completed').aggregate(total=Sum('total_amount'))
    total_revenue = revenue_data['total'] or 0.00
    
    return Response({
        "total_products": total_products,
        "low_stock": low_stock_count,
        "total_revenue": total_revenue 
    })

@api_view(['GET'])
def get_current_user(request):
    """Returns the logged-in user's role and unique ID."""
    if request.user.is_authenticated:
        role = 'Admin' if request.user.is_superuser else 'Cashier'
        return Response({'username': request.user.username, 'user_id': request.user.id, 'role': role})
    return Response({'username': 'Guest', 'user_id': 0, 'role': 'Admin'})