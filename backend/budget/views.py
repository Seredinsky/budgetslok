from rest_framework import viewsets, parsers
from django.shortcuts import get_object_or_404

from .models import BudgetItem, Work, Material, QuarterReserve
from .serializers import (
    BudgetItemSerializer,
    WorkSerializer,
    MaterialSerializer,
    ReserveSerializer,
)

from rest_framework.decorators import action
from rest_framework.response import Response
from decimal import Decimal

class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.prefetch_related("works__materials")
    serializer_class = BudgetItemSerializer

class WorkViewSet(viewsets.ModelViewSet):
    queryset = Work.objects.all()
    serializer_class = WorkSerializer

class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.all()
    serializer_class = MaterialSerializer
    parser_classes   = (parsers.MultiPartParser, parsers.FormParser)

    # чтобы POST ожидал work-id
    def perform_create(self, serializer):
        work_id = self.request.data.get("work")
        work    = get_object_or_404(Work, pk=work_id)
        serializer.save(work=work)

class ReserveViewSet(viewsets.ModelViewSet):
    queryset = QuarterReserve.objects.all()
    serializer_class = ReserveSerializer

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