from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WarehouseViewSet, ZoneViewSet, BinViewSet

router = DefaultRouter()
router.register(r"warehouses", WarehouseViewSet)
router.register(r"zones", ZoneViewSet)
router.register(r"bins", BinViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
