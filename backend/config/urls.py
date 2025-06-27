from django.contrib import admin
from django.urls import path, include, re_path
from django.views.generic import TemplateView
from django.http import HttpResponse
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
from django.views.static import serve as static_serve

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
    path("health/", lambda request: HttpResponse("ok"), name="health"),
]

# Serve media files at MEDIA_URL
urlpatterns += static(
    settings.MEDIA_URL, document_root=settings.MEDIA_ROOT
)

# Backward compatibility for URLs like /materials/materials/…
urlpatterns += [
    re_path(
        r'^materials/materials/(?P<path>.*)$',
        static_serve,
        {'document_root': settings.MEDIA_ROOT / 'materials'},
    ),
]

# React single‑page app – return index.html for any unmatched route
urlpatterns += [
    re_path(r"^(?:.*)/?$", TemplateView.as_view(template_name="index.html"), name="spa"),
]