from rest_framework import serializers
from .models import BudgetItem, Work, Material, QuarterReserve, PaymentDetail
from .models import Group
from django.contrib.auth.models import User


class MaterialSerializer(serializers.ModelSerializer):
    class Meta:
        model = Material
        fields = ("id", "file", "uploaded_at")


class PaymentDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentDetail
        fields = (
            'id', 'month', 'amount',
            'creditor', 'contract', 'pfm', 'fp',
            'mvz', 'mm', 'payment_document',
            'payment_close', 'comment', 'comment_file'
        )
        read_only_fields = ('id',)
        extra_kwargs = {
            'month': {'required': False},
            'amount': {'required': False},
        }

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
    payment_details = PaymentDetailSerializer(many=True, required=False)
    # Include parent item's group details
    group = GroupSerializer(source="item.group", read_only=True)

    feasibility = serializers.ChoiceField(
        choices=Work.FEASIBILITY_CHOICES,
        default='green'
    )

    def create(self, validated_data):
        details = validated_data.pop('payment_details', [])
        work = super().create(validated_data)
        for det in details:
            PaymentDetail.objects.create(work=work, **det)
        return work

    def update(self, instance, validated_data):
        details = validated_data.pop('payment_details', None)
        work = super().update(instance, validated_data)
        if details is not None:
            instance.payment_details.all().delete()
            for det in details:
                # Если файл комментария не передан, убираем ключ, чтобы не валидировать
                if det.get('comment_file') in (None, {}, ''):
                    det.pop('comment_file', None)
                PaymentDetail.objects.create(work=work, **det)
        return work

    class Meta:
        model = Work
        fields = (
            "id", "item",
            "year", "responsible",
            "name", "justification", "comment",
            "accruals", "payments",
            "actual_accruals", "actual_payments",
            "payment_details",
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