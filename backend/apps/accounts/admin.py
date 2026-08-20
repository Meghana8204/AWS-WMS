from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, Role

class CustomUserAdmin(UserAdmin):
    list_display = ("username", "email", "is_active", "is_staff")
    filter_horizontal = ("roles", "user_permissions", "groups")
    fieldsets = UserAdmin.fieldsets + (
        ("Enterprise Roles", {"fields": ("roles",)}),
    )

admin.site.register(User, CustomUserAdmin)
admin.site.register(Role)
