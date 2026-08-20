from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    SupplierViewSet, SupplierContactViewSet, SupplierAddressViewSet,
    SupplierDocumentViewSet, SupplierQualificationViewSet
)

router = DefaultRouter()
router.register(r"contacts", SupplierContactViewSet)
router.register(r"addresses", SupplierAddressViewSet)
router.register(r"documents", SupplierDocumentViewSet)
router.register(r"qualification-history", SupplierQualificationViewSet)
router.register(r"", SupplierViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
