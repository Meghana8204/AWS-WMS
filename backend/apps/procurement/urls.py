from django.urls import path
from .views import ProcurementDashboardView

urlpatterns = [
    path("dashboard/", ProcurementDashboardView.as_view(), name="procurement-dashboard"),
]
