from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GateEntryViewSet

router = DefaultRouter()
router.register(r"", GateEntryViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
