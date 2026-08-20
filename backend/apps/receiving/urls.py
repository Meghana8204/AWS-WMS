from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GRNViewSet, GRNLineViewSet

router = DefaultRouter()
router.register(r"grns", GRNViewSet)
router.register(r"lines", GRNLineViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
