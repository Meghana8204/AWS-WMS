from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .models import User, Role
from .serializers import (
    UserSerializer, UserCreateSerializer, RoleSerializer, CustomTokenObtainPairSerializer
)

class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response({
            "success": True,
            "data": serializer.data
        })

class RoleViewSet(viewsets.ModelViewSet):
    queryset = Role.objects.all()
    serializer_class = RoleSerializer
    permission_classes = [IsAuthenticated]

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.action == 'create':
            return UserCreateSerializer
        return UserSerializer

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def forgot_password(self, request):
        # In a real app, send email with token. For now, mock.
        email = request.data.get('email')
        return Response({
            "success": True,
            "message": f"If an account exists for {email}, a reset link has been sent."
        })

    @action(detail=False, methods=['post'], permission_classes=[AllowAny])
    def reset_password(self, request):
        # Mock reset
        return Response({
            "success": True,
            "message": "Password has been successfully reset."
        })

from rest_framework_simplejwt.views import TokenObtainPairView
from .serializers import CustomTokenObtainPairSerializer

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer
