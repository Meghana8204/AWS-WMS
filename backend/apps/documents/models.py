from django.db import models
from common.models import BaseModel

class Document(BaseModel):
    DOCUMENT_TYPES = (
        ("PO", "Purchase Order"),
        ("INVOICE", "Invoice"),
        ("PACKING_LIST", "Packing List"),
        ("GRN", "Goods Receipt Note"),
        ("QUALITY_CERT", "Quality Certificate"),
        ("OTHER", "Other"),
    )

    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPES)
    document_number = models.CharField(max_length=100)
    document_date = models.DateField(null=True, blank=True)

    file = models.FileField(upload_to="documents/%Y/%m/%d/")

    # Generic relations (simplified for now)
    linked_entity_type = models.CharField(max_length=50, blank=True)
    linked_entity_id = models.UUIDField(null=True, blank=True)

    # OCR Data
    ocr_status = models.CharField(max_length=20, default="PENDING")
    ocr_result = models.JSONField(null=True, blank=True)
    is_validated = models.BooleanField(default=False)
    validated_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.document_type} - {self.document_number}"
