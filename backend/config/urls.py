from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static  # ⬅ медиа в DEBUG
from rest_framework.routers import DefaultRouter
from budget.views import BudgetItemViewSet, WorkViewSet, MaterialViewSet

router = DefaultRouter()
router.register(r"items", BudgetItemViewSet)
router.register(r"works", WorkViewSet)
router.register(r"materials", MaterialViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(router.urls)),
]

# Раздаём загруженные файлы в режиме DEBUG
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
    )