from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ASNViewSet, ASNLineViewSet

router = DefaultRouter()
router.register(r"asns", ASNViewSet)
router.register(r"lines", ASNLineViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
