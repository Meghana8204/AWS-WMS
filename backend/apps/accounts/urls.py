from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenBlacklistView,
)
from .views import MeView, CustomTokenObtainPairView, UserViewSet, RoleViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet)
router.register(r"roles", RoleViewSet)

urlpatterns = [
    path("login/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("logout/", TokenBlacklistView.as_view(), name="token_blacklist"),
    path("me/", MeView.as_view(), name="me"),
    path("forgot-password/", UserViewSet.as_view({'post': 'forgot_password'}), name="forgot_password"),
    path("reset-password/", UserViewSet.as_view({'post': 'reset_password'}), name="reset_password"),
    path("", include(router.urls)),
]
