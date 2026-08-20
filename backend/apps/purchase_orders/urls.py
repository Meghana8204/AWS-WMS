from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PurchaseOrderViewSet, POLineItemViewSet

router = DefaultRouter()
router.register(r"orders", PurchaseOrderViewSet)
router.register(r"lines", POLineItemViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
