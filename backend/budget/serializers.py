from rest_framework import serializers
from .models import BudgetItem, Work, Material, QuarterReserve, PaymentDetail, AccrualDetail
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
            'payment_close', 'comment', 'comment_file',
            'cancel_reason', 'transfer_reason',
        )
        read_only_fields = ('id',)
        extra_kwargs = {
            'month': {'required': False},
            'amount': {'required': False},
            'cancel_reason': {'required': False, 'allow_blank': True},
            'transfer_reason': {'required': False, 'allow_blank': True},
        }

class AccrualDetailSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccrualDetail
        fields = (
            'id', 'month', 'amount',
            'closing_document', 'comment', 'comment_file',
            'cancel_reason', 'transfer_reason',
        )
        read_only_fields = ('id',)
        extra_kwargs = {
            'month': {'required': False},
            'amount': {'required': False},
            'cancel_reason': {'required': False, 'allow_blank': True},
            'transfer_reason': {'required': False, 'allow_blank': True},
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
    accrual_details = AccrualDetailSerializer(many=True, required=False)
    # Include parent item's group details
    group = GroupSerializer(source="item.group", read_only=True)

    feasibility = serializers.ChoiceField(
        choices=Work.FEASIBILITY_CHOICES,
        default='green'
    )
    # Поля сертификации
    certification = serializers.BooleanField(required=False)
    work_type = serializers.CharField(required=False, allow_blank=True)
    product_name = serializers.CharField(required=False, allow_blank=True)
    responsible_slok = serializers.CharField(required=False, allow_blank=True)
    responsible_dpm = serializers.CharField(required=False, allow_blank=True)
    certificate_number = serializers.CharField(required=False, allow_blank=True)
    certification_body = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        pay_details = validated_data.pop('payment_details', [])
        accr_details = validated_data.pop('accrual_details', [])
        work = super().create(validated_data)
        for det in pay_details:
            PaymentDetail.objects.create(work=work, **det)
        for det in accr_details:
            AccrualDetail.objects.create(work=work, **det)
        return work

    def update(self, instance, validated_data):
        pay_details = validated_data.pop('payment_details', None)
        accr_details = validated_data.pop('accrual_details', None)
        work = super().update(instance, validated_data)
        if pay_details is not None:
            instance.payment_details.all().delete()
            for det in pay_details:
                # удалить пустой файл и старый id перед созданием
                if det.get('comment_file') in (None, {}, ''):
                    det.pop('comment_file', None)
                det.pop('id', None)
                PaymentDetail.objects.create(work=work, **det)
        if accr_details is not None:
            instance.accrual_details.all().delete()
            for det in accr_details:
                # удалить пустой файл и старый id перед созданием
                if det.get('comment_file') in (None, {}, ''):
                    det.pop('comment_file', None)
                det.pop('id', None)
                AccrualDetail.objects.create(work=work, **det)
        return work

    class Meta:
        model = Work
        fields = (
            "id", "item",
            "year", "responsible",
            "name", "justification", "comment",
            "certification", "work_type", "product_name", "responsible_slok", "responsible_dpm", "certificate_number", "certification_body",
            "accruals", "payments",
            "actual_accruals", "actual_payments",
            "payment_details",
            "accrual_details",
            "vat_rate",
            "feasibility",
            "materials",
            "group",  # optional: include item group
        )

class BudgetItemSerializer(serializers.ModelSerializer):
    group = GroupSerializer(read_only=True)
    works = WorkSerializer(source='detailed_works', many=True, read_only=True)

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