from django.db import models
from common.models import BaseModel

class QualityInspection(BaseModel):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("PASS", "Pass"),
        ("HOLD", "Hold"),
        ("FAIL", "Fail"),
    )

    inspection_number = models.CharField(max_length=50, unique=True, editable=False)
    grn = models.ForeignKey("receiving.GRN", on_delete=models.CASCADE, related_name="inspections")
    item = models.ForeignKey("items.Item", on_delete=models.PROTECT)

    inspector = models.ForeignKey("accounts.User", on_delete=models.PROTECT)
    inspection_date = models.DateTimeField(auto_now_add=True)

    result = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    remarks = models.TextField(blank=True)

    def save(self, *args, **kwargs):
        if not self.inspection_number:
            import uuid
            self.inspection_number = f"QI-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.inspection_number

class NonConformanceReport(BaseModel):
    ncr_number = models.CharField(max_length=50, unique=True, editable=False)
    inspection = models.OneToOneField(QualityInspection, on_delete=models.CASCADE, related_name="ncr")

    defect_category = models.CharField(max_length=100)
    description = models.TextField()
    root_cause = models.TextField(blank=True)
    corrective_action = models.TextField(blank=True)

    disposition = models.CharField(max_length=50, default="PENDING") # e.g. RETURN, SCRAP, REWORK

    def save(self, *args, **kwargs):
        if not self.ncr_number:
            import uuid
            self.ncr_number = f"NCR-{uuid.uuid4().hex[:8].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.ncr_number
