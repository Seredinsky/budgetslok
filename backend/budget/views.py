from rest_framework import viewsets, parsers, serializers
from rest_framework import permissions
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.db.models import Prefetch

from .models import BudgetItem, Work, Material, QuarterReserve, PaymentDetail
from .serializers import (
    BudgetItemSerializer,
    WorkSerializer,
    MaterialSerializer,
    ReserveSerializer,
    UserLightSerializer,
    PaymentDetailSerializer,
)

from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal
import json
from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import csrf_exempt
from django.http import JsonResponse, HttpResponseNotAllowed
from rest_framework.views import APIView

# --- Custom permission -------------------------------------------------
class IsOwnerOrCanEditAny(permissions.BasePermission):
    """
    Allow access to objects the user owns, or to anyone with the
    custom `budget.change_any_work` permission.
    """

    def has_object_permission(self, request, view, obj):
        if request.user.has_perm("budget.change_any_work"):
            return True
        # For Work / Material objects we can safely check `.responsible`
        resp_id = getattr(obj, "responsible_id", None)
        return resp_id == request.user.id

# ---- Session-based login/logout --------------------------------------
@csrf_exempt
def session_login(request):
    """
    POST {username, password}  -> sets sessionid cookie
    """
    if request.method != "POST":
        return JsonResponse({"detail": "method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
    except ValueError:
        return JsonResponse({"detail": "invalid JSON"}, status=400)

    user = authenticate(
        request,
        username=data.get("username"),
        password=data.get("password"),
    )
    if user is None:
        return JsonResponse({"detail": "invalid creds"}, status=400)

    login(request, user)
    return JsonResponse({"detail": "ok"})

@csrf_exempt
def session_logout(request):
    """
    POST /api/logout/ — завершить сессию. Делаем CSRF-exempt, чтобы SPA
    могла вызывать без токена, так же как login.
    """
    if request.method != "POST":
        return HttpResponseNotAllowed(["POST"])
    logout(request)
    return JsonResponse({"detail": "ok"})

class CurrentUserView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        u = request.user
        return JsonResponse(
            {
                "id": u.id,
                "username": u.username,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "full_name": u.get_full_name().strip(),
                "is_admin": u.has_perm("budget.change_any_work"),
            }
        )

class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.prefetch_related(
        Prefetch(
            'works',
            queryset=Work.objects.with_details().prefetch_related('materials'),
            to_attr='detailed_works'
        )
    ).prefetch_related('materials')
    serializer_class = BudgetItemSerializer
    permission_classes = [permissions.IsAuthenticated]

class WorkViewSet(viewsets.ModelViewSet):
    queryset = Work.objects.with_details()
    serializer_class = WorkSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrCanEditAny]
    parser_classes = (
        parsers.JSONParser,
        parsers.MultiPartParser,
        parsers.FormParser,
    )

    def get_queryset(self):
        qs = Work.objects.with_details()
        user = self.request.user
        if user.has_perm("budget.change_any_work"):
            return qs
        return qs.filter(responsible=user)

    def perform_create(self, serializer):
        # обычный пользователь создаёт работу только для себя
        if self.request.user.has_perm("budget.change_any_work"):
            serializer.save()
        else:
            serializer.save(responsible=self.request.user)

    def perform_update(self, serializer):
        work = self.get_object()
        # Разрешаем обновление только создателю или при наличии специального права
        if not self.request.user.has_perm('budget.change_any_work') \
           and work.responsible_id != self.request.user.id:
            raise permissions.PermissionDenied('Нельзя редактировать чужую работу')
        serializer.save()

class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related('work', 'item')
    serializer_class = MaterialSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrCanEditAny]
    parser_classes   = (parsers.MultiPartParser, parsers.FormParser)

    # чтобы POST ожидал work-id или item-id
    def perform_create(self, serializer):
        work_id = self.request.data.get("work")
        item_id = self.request.data.get("item")

        if work_id:
            obj = get_object_or_404(Work, pk=work_id)
            if not self.request.user.has_perm("budget.change_any_work") \
               and obj.responsible_id != self.request.user.id:
                raise permissions.PermissionDenied("Нельзя прикрепить к чужой работе")
            serializer.save(work=obj)
        elif item_id:
            obj = get_object_or_404(BudgetItem, pk=item_id)
            serializer.save(item=obj)
        else:
            raise serializers.ValidationError("Нужно указать либо work, либо item")

class PaymentDetailViewSet(viewsets.ModelViewSet):
    """CRUD для деталей оплаты"""
    queryset = PaymentDetail.objects.select_related('work')
    serializer_class = PaymentDetailSerializer
    permission_classes = [permissions.IsAuthenticated, IsOwnerOrCanEditAny]
    parser_classes = (parsers.MultiPartParser, parsers.FormParser)

    def perform_create(self, serializer):
        work_id = self.request.data.get('work')
        work = get_object_or_404(Work, pk=work_id)
        # проверяем права на работу
        if not self.request.user.has_perm('budget.change_any_work') and work.responsible_id != self.request.user.id:
            raise permissions.PermissionDenied('Нельзя создать деталь оплаты для чужой работы')
        serializer.save(work=work)

class ReserveViewSet(viewsets.ModelViewSet):
    queryset = QuarterReserve.objects.all()
    serializer_class = ReserveSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=True, methods=["post"])
    def write_off(self, request, pk):
        """ списать резерв под новую работу """
        reserve = self.get_object()
        amount_acc = Decimal(request.data.get("acc", 0))
        amount_pay = Decimal(request.data.get("pay", 0))

        if amount_acc > reserve.accrual_sum - reserve.used_acc:
            return Response({"detail": "Недостаточно резерва Н"},
                            status=400)
        if amount_pay > reserve.payment_sum - reserve.used_pay:
            return Response({"detail": "Недостаточно резерва О"},
                            status=400)

        reserve.used_acc += amount_acc
        reserve.used_pay += amount_pay
        reserve.save()

        return Response(self.get_serializer(reserve).data)



# ---- Users -----------------------------------------------------------
User = get_user_model()

class UserViewSet(viewsets.ReadOnlyModelViewSet):
    """
    GET /api/users/  – список пользователей (id, username, first_name, last_name, full_name).
    Только для аутентифицированных.
    """
    queryset = User.objects.all().order_by("username")
    serializer_class = UserLightSerializer
    permission_classes = [permissions.IsAuthenticated]