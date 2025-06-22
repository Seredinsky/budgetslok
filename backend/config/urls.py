from django.contrib import admin
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from budget.views import BudgetItemViewSet, WorkViewSet

router = DefaultRouter()
router.register(r"items", BudgetItemViewSet)
router.register(r"works", WorkViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
]