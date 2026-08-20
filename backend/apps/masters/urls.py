from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, UOMViewSet, CurrencyViewSet, PaymentTermViewSet
)

router = DefaultRouter()
router.register(r"categories", CategoryViewSet)
router.register(r"uoms", UOMViewSet)
router.register(r"currencies", CurrencyViewSet)
router.register(r"payment-terms", PaymentTermViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
