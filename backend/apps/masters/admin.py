from django.contrib import admin
from .models import Category, UOM, Currency, PaymentTerm

admin.site.register(Category)
admin.site.register(UOM)
admin.site.register(Currency)
admin.site.register(PaymentTerm)
