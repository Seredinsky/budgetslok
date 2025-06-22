from rest_framework import serializers
from .models import BudgetItem, Work, Material

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ("id", "file")

class WorkSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(
        queryset=BudgetItem.objects.all(),
        write_only=True
    )
    materials = MaterialSerializer(many=True, read_only=True)

    class Meta:
        model = Work
        fields = (
            "id", "item",
            "year", "responsible",          # ← новые
            "name", "justification", "comment",
            "accruals", "payments",
            "actual_accruals", "actual_payments",
            "materials",
        )

class BudgetItemSerializer(serializers.ModelSerializer):
    works = WorkSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetItem
        fields = ("id", "name", "works")