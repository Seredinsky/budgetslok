from django.views.generic import RedirectView
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

# Serve all media files under /materials/ in production and debug
urlpatterns += [
    re_path(
        r'^materials/(?P<path>.*)$',
        static_serve,
        {'document_root': settings.MEDIA_ROOT},
    ),
]

# Serve Django static files at STATIC_URL
urlpatterns += static(
    settings.STATIC_URL, document_root=settings.STATIC_ROOT
)

# Serve React build files under /static/react/
urlpatterns += static(
    '/static/react/',
    document_root=settings.FRONTEND_DIST
)

# Serve PWA files like sw.js and manifest.webmanifest from the site root
urlpatterns += [
    path(
        "sw.js",
        static_serve,
        {
            "path": "sw.js",
            "document_root": settings.BASE_DIR / "static",
        },
    ),
    path(
        "manifest.webmanifest",
        static_serve,
        {
            "path": "manifest.webmanifest",
            "document_root": settings.BASE_DIR / "static",
        },
    ),
]

# React single‑page app – return production index.html from dist for any unmatched route
urlpatterns += [
    re_path(
        r'^(?!admin/|api/|materials/|static/).*$',
        static_serve,
        {'path': 'index.html', 'document_root': settings.FRONTEND_DIST},
        name="spa"
    ),
]