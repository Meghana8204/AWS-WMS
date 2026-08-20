from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),

    # API v1
    path("api/v1/auth/", include("accounts.urls")),
    path("api/v1/organization/", include("organization.urls")),
    path("api/v1/warehouses/", include("warehouses.urls")),
    path("api/v1/items/", include("items.urls")),
    path("api/v1/masters/", include("masters.urls")),
    path("api/v1/suppliers/", include("suppliers.urls")),
    path("api/v1/procurement/", include("procurement.urls")),
    path("api/v1/purchase-orders/", include("purchase_orders.urls")),
    path("api/v1/asn/", include("asn.urls")),
    path("api/v1/shipments/", include("shipments.urls")),
    path("api/v1/gate-entries/", include("gate_entry.urls")),
    path("api/v1/receiving/", include("receiving.urls")),
    path("api/v1/inventory/", include("inventory.urls")),

    # Legacy / Transition (Commented out to prevent 500 errors from old model dependencies)
    # path("api/suppliers/", include("suppliers.urls")),
]
