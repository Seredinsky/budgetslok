from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.conf import settings
from django.conf.urls.static import static  # ⬅ медиа в DEBUG
from rest_framework.routers import DefaultRouter
from budget.views import (
    BudgetItemViewSet,
    WorkViewSet,
    MaterialViewSet,
    ReserveViewSet,
    UserViewSet,
    session_login,
    session_logout,
    CurrentUserView,
)

router = DefaultRouter()
router.register(r"items", BudgetItemViewSet)
router.register(r"works", WorkViewSet)
router.register(r"materials", MaterialViewSet)
router.register(r"reserves", ReserveViewSet)
router.register(r"users", UserViewSet, basename="user")

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/login/",  session_login, name="api_login"),
    path("api/logout/", session_logout, name="api_logout"),
    path("api/users/me/", CurrentUserView.as_view(), name="api_me"),
    path("api/", include(router.urls)),
    # React single‑page app – return index.html for any unmatched route
    re_path(r"^(?:.*)/?$", TemplateView.as_view(template_name="index.html"), name="spa"),
]

# Раздаём загруженные файлы в режиме DEBUG
if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
    )