from rest_framework import serializers
from .models import BudgetItem, Work, Material, QuarterReserve
from .models import Group
from django.contrib.auth.models import User


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ("id", "file", "uploaded_at")


class UserLightSerializer(serializers.ModelSerializer):
    """Лёгкий сериализатор пользователя для справочника/read-only."""
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ("id", "username", "first_name", "last_name", "full_name")

    def get_full_name(self, obj):
        return obj.get_full_name().strip()

class GroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = Group
        fields = ("id", "code", "name")

class WorkSerializer(serializers.ModelSerializer):
    item = serializers.PrimaryKeyRelatedField(
        queryset=BudgetItem.objects.all(),
        write_only=True
    )
    responsible = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all()
    )
    materials = MaterialSerializer(many=True, read_only=True)
    # Include parent item's group details
    group = GroupSerializer(source="item.group", read_only=True)

    feasibility = serializers.ChoiceField(
        choices=Work.FEASIBILITY_CHOICES,
        default='green'
    )

    class Meta:
        model = Work
        fields = (
            "id", "item",
            "year", "responsible",
            "name", "justification", "comment",
            "accruals", "payments",
            "actual_accruals", "actual_payments",
            "vat_rate",
            "feasibility",
            "materials",
            "group",  # optional: include item group
        )

class BudgetItemSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    works = WorkSerializer(many=True, read_only=True)

    class Meta:
        model = BudgetItem
        fields = (
            "id",
            "name",
            "position",
            "group",
            "certification",
            "work_type",
            "product_name",
            "responsible_slok",
            "responsible_dpm",
            "certificate_number",
            "certification_body",
            "works",
        )

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