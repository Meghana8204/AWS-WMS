from django.contrib import admin
from .models import (
    Supplier, SupplierContact, SupplierAddress,
    SupplierCategoryMapping, SupplierDocument, SupplierQualification
)

admin.site.register(Supplier)
admin.site.register(SupplierContact)
admin.site.register(SupplierAddress)
admin.site.register(SupplierCategoryMapping)
admin.site.register(SupplierDocument)
admin.site.register(SupplierQualification)
