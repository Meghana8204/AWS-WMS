from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import (
    Supplier, SupplierContact, SupplierAddress,
    SupplierDocument, SupplierQualification
)
from .serializers import (
    SupplierSerializer, SupplierContactSerializer, SupplierAddressSerializer,
    SupplierDocumentSerializer, SupplierQualificationSerializer
)

class SupplierViewSet(viewsets.ModelViewSet):
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer

    @action(detail=True, methods=["post"])
    def update_status(self, request, pk=None):
        supplier = self.get_object()
        to_status = request.data.get("status")
        comments = request.data.get("comments", "")

        if not to_status:
            return Response({"error": "Status is required"}, status=status.HTTP_400_BAD_REQUEST)

        from_status = supplier.status
        supplier.status = to_status
        supplier.save()

        SupplierQualification.objects.create(
            supplier=supplier,
            from_status=from_status,
            to_status=to_status,
            comments=comments,
            performed_by=request.user
        )

        return Response({"message": f"Status updated to {to_status}"})

class SupplierContactViewSet(viewsets.ModelViewSet):
    queryset = SupplierContact.objects.all()
    serializer_class = SupplierContactSerializer

class SupplierAddressViewSet(viewsets.ModelViewSet):
    queryset = SupplierAddress.objects.all()
    serializer_class = SupplierAddressSerializer

class SupplierDocumentViewSet(viewsets.ModelViewSet):
    queryset = SupplierDocument.objects.all()
    serializer_class = SupplierDocumentSerializer

class SupplierQualificationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = SupplierQualification.objects.all()
    serializer_class = SupplierQualificationSerializer
