from rest_framework import serializers
from .models import BudgetItem, Work, Material, QuarterReserve

class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ("id", "file", "uploaded_at")

class WorkSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(
        queryset=BudgetItem.objects.all(),
        write_only=True
    )
    materials = MaterialSerializer(many=True, read_only=True)
    group = serializers.CharField(source="item.group", read_only=True)

    class Meta:
        model = Work
        fields = (
            "id", "item",
            "year", "responsible",
            "name", "justification", "comment",
            "accruals", "payments",
            "actual_accruals", "actual_payments",
            "vat_rate",
            "materials",
            "group",  # optional: include item group
        )

class BudgetItemSerializer(serializers.ModelSerializer):
    works = WorkSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetItem
        fields = ("id", "name", "group", "works")

class ReserveSerializer(serializers.ModelSerializer):
    balance_acc = serializers.SerializerMethodField()
    balance_pay = serializers.SerializerMethodField()

    class Meta:
        model = QuarterReserve
        fields = (
            "id", "item", "year", "quarter",
            "accrual_sum", "payment_sum",
            "used_acc", "used_pay",
            "balance_acc", "balance_pay",
        )

    def get_balance_acc(self, obj):
        return obj.accrual_sum - obj.used_acc

    def get_balance_pay(self, obj):
        return obj.payment_sum - obj.used_pay