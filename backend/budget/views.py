from rest_framework import viewsets
from .models import BudgetItem, Work
from .serializers import BudgetItemSerializer, WorkSerializer

class BudgetItemViewSet(viewsets.ModelViewSet):
    queryset = BudgetItem.objects.prefetch_related("works__materials")
    serializer_class = BudgetItemSerializer

class WorkViewSet(viewsets.ModelViewSet):
    queryset = Work.objects.all()
    serializer_class = WorkSerializer