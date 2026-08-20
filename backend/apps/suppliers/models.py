import uuid
from django.db import models
from common.models import BaseModel

class Supplier(BaseModel):
    STATUS_CHOICES = (
        ("DRAFT", "Draft"),
        ("UNDER_REVIEW", "Under Review"),
        ("QUALIFIED", "Qualified"),
        ("APPROVED", "Approved"),
        ("ACTIVE", "Active"),
        ("SUSPENDED", "Suspended"),
        ("BLOCKED", "Blocked"),
        ("INACTIVE", "Inactive"),
        ("REJECTED", "Rejected"),
    )

    supplier_code = models.CharField(max_length=20, unique=True, editable=False)
    supplier_name = models.CharField(max_length=200)
    registered_company_name = models.CharField(max_length=250)
    vendor_type = models.CharField(max_length=100) # e.g. Manufacturer, Trader
    industry = models.CharField(max_length=150)
    tax_number = models.CharField(max_length=50, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)
    country = models.CharField(max_length=100)
    default_currency = models.ForeignKey("masters.Currency", on_delete=models.PROTECT, related_name="suppliers")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="DRAFT")

    def save(self, *args, **kwargs):
        if not self.supplier_code:
            # Simple auto-generation logic
            last_supplier = Supplier.objects.order_by("-created_at").first()
            if not last_supplier:
                self.supplier_code = "SUP-000001"
            else:
                try:
                    last_id = int(last_supplier.supplier_code.split("-")[1])
                    self.supplier_code = f"SUP-{str(last_id + 1).zfill(6)}"
                except (IndexError, ValueError):
                    self.supplier_code = f"SUP-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.supplier_name} ({self.supplier_code})"

class SupplierContact(BaseModel):
    CONTACT_TYPES = (
        ("PROCUREMENT", "Procurement"),
        ("LOGISTICS", "Logistics"),
        ("QUALITY", "Quality"),
        ("FINANCE", "Finance"),
        ("MANAGEMENT", "Management"),
    )

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="contacts")
    name = models.CharField(max_length=200)
    designation = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    mobile = models.CharField(max_length=50)
    contact_type = models.CharField(max_length=20, choices=CONTACT_TYPES)
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.name} - {self.supplier.supplier_name}"

class SupplierAddress(BaseModel):
    ADDRESS_TYPES = (
        ("REGISTERED", "Registered"),
        ("BILLING", "Billing"),
        ("MANUFACTURING", "Manufacturing"),
        ("SHIPPING", "Shipping"),
    )

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="addresses")
    address_type = models.CharField(max_length=20, choices=ADDRESS_TYPES)
    address_line_1 = models.CharField(max_length=255)
    address_line_2 = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100)
    state = models.CharField(max_length=100)
    postal_code = models.CharField(max_length=20)
    country = models.CharField(max_length=100)
    is_primary = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.address_type} - {self.supplier.supplier_name}"

class SupplierCategoryMapping(BaseModel):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="category_mappings")
    category = models.ForeignKey("masters.Category", on_delete=models.CASCADE, related_name="supplier_mappings")
    is_approved = models.BooleanField(default=False)

    class Meta:
        unique_together = ("supplier", "category")

class SupplierDocument(BaseModel):
    STATUS_CHOICES = (
        ("PENDING", "Pending"),
        ("VALID", "Valid"),
        ("EXPIRING", "Expiring"),
        ("EXPIRED", "Expired"),
        ("REJECTED", "Rejected"),
    )

    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=100) # e.g. ISO 9001
    document_number = models.CharField(max_length=100)
    issue_date = models.DateField()
    expiry_date = models.DateField(null=True, blank=True)
    version = models.IntegerField(default=1)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="PENDING")
    file = models.FileField(upload_to="suppliers/documents/")
    verified_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="verified_documents")
    verified_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.document_type} - {self.supplier.supplier_name} (v{self.version})"

class SupplierQualification(BaseModel):
    # This acts as an audit trail for qualification status changes
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="qualification_history")
    from_status = models.CharField(max_length=20)
    to_status = models.CharField(max_length=20)
    comments = models.TextField(blank=True)
    performed_by = models.ForeignKey("accounts.User", on_delete=models.SET_NULL, null=True, blank=True)
