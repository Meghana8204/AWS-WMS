from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DiscrepancyViewSet

router = DefaultRouter()
router.register(r"", DiscrepancyViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
