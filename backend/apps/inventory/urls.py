from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TraceabilityRecordViewSet, InventoryBalanceViewSet

router = DefaultRouter()
router.register(r"traceability", TraceabilityRecordViewSet)
router.register(r"balances", InventoryBalanceViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
