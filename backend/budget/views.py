from rest_framework import viewsets, parsers
from django.shortcuts import get_object_or_404

from .models import BudgetItem, Work, Material
from .serializers import (
    BudgetItemSerializer,
    WorkSerializer,
    MaterialSerializer,
)

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