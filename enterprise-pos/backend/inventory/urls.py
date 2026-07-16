from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, ProductViewSet, SaleViewSet, process_checkout, get_reports, process_refund, get_current_user

router = DefaultRouter()
router.register(r'categories', CategoryViewSet)
router.register(r'products', ProductViewSet)
router.register(r'sales', SaleViewSet, basename='sale')

urlpatterns = [
    # The router handles all the standard database API calls automatically
    path('', include(router.urls)),
    
    # Custom endpoints
    path('checkout/', process_checkout, name='checkout'),
    path('refund/<int:sale_id>/', process_refund, name='refund'),
    path('reports/', get_reports, name='reports'),
    path('me/', get_current_user, name='current_user'),
]