from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Document
from .serializers import DocumentSerializer

class DocumentViewSet(viewsets.ModelViewSet):
    queryset = Document.objects.all()
    serializer_class = DocumentSerializer

    @action(detail=True, methods=["post"])
    def ocr(self, request, pk=None):
        doc = self.get_object()
        # Mock OCR logic
        doc.ocr_status = "COMPLETED"
        doc.ocr_result = {
            "document_number": doc.document_number,
            "date": "2026-08-11",
            "items": [
                {"description": "Transformer Core", "quantity": 10, "amount": 50000}
            ],
            "total_amount": 50000
        }
        doc.save()
        return Response({"success": True, "data": doc.ocr_result})

    @action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        doc = self.get_object()
        doc.is_validated = True
        doc.validated_by = request.user
        doc.save()
        return Response({"message": "Document validated successfully"})
