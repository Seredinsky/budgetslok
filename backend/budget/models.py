from django.db import models
from django.utils import timezone
from django.conf import settings

class WorkQuerySet(models.QuerySet):
    """QuerySet for Work model to prefetch related detail records."""
    def with_details(self):
        return self.prefetch_related(
            'payment_details',
            'accrual_details',
        )

class Group(models.Model):
    """Справочник групп статей бюджета."""
    code = models.CharField("Код группы", max_length=50, unique=True)
    name = models.CharField("Наименование группы", max_length=200)

    class Meta:
        verbose_name = "Группа статьи"
        verbose_name_plural = "Группы статей"


    def __str__(self):
        return self.name



class BudgetItem(models.Model):
    """Статья бюджета (ИТ-Инфраструктура, Маркетинг …)"""
    name = models.CharField(max_length=100)
    # Порядок отображения статей
    position = models.PositiveIntegerField(
        "Позиция",
        default=0,
        help_text="Чем меньше значение — выше в списке"
    )
    group = models.ForeignKey(
        Group,
        verbose_name="Группа",
        related_name="items",
        on_delete=models.PROTECT
    )

    certification = models.BooleanField(
        default=False,
        verbose_name="Сертификация",
        help_text="Отмечается, если требуется сертификация"
    )

    WORK_TYPE_CHOICES = [
        ('ИК_СС_ТР_ТС', 'ИК СС ТР ТС'),
        ('ИК_СС_ГОСТ', 'ИК СС ГОСТ'),
        ('СС_ТР_ТС',    'СС ТР ТС'),
        ('ДС_ТР_ТС',    'ДС ТР ТС'),
        ('СС_ПБ',       'СС ПБ'),
        ('СС_ГОСТ',     'СС ГОСТ'),
        ('НОТИФИКАЦИЯ','Нотификация'),
        ('СГР',         'СГР'),
        ('МИНПРОМТОРГ','МИНПРОМТОРГ'),
        ('УТСИ',        'УТСИ'),
    ]

    work_type = models.CharField(
        max_length=20,
        choices=WORK_TYPE_CHOICES,
        blank=True,
        null=True,
        verbose_name="Вид работы"
    )

    product_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Наименование продукта"
    )
    responsible_slok = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Ответственный от СлОК"
    )
    responsible_dpm = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Ответственный от ДПМ"
    )
    certificate_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="№ сертификата (для ИК)"
    )
    certification_body = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Орган по сертификации"
    )

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["position"]


class Work(models.Model):
    """Отдельная работа внутри статьи"""
    objects = WorkQuerySet.as_manager()
    item = models.ForeignKey(BudgetItem, related_name="works",
                             on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    justification = models.TextField(blank=True)
    comment = models.TextField(blank=True)

    # Параметры сертификации для работы
    certification = models.BooleanField(
        default=False,
        verbose_name="Сертификация"
    )
    work_type = models.CharField(
        max_length=20,
        choices=BudgetItem.WORK_TYPE_CHOICES,
        blank=True,
        null=True,
        verbose_name="Вид работы"
    )
    product_name = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Наименование продукта"
    )
    responsible_slok = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Ответственный от СлОК"
    )
    responsible_dpm = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Ответственный от ДПМ"
    )
    certificate_number = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name="№ сертификата (для ИК)"
    )
    certification_body = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        verbose_name="Орган по сертификации"
    )

    # Планы и факты храним JSON-ом: {'Янв':1200, 'Мар':800}
    accruals = models.JSONField(default=dict)         # план Н
    payments = models.JSONField(default=dict)         # план О
    actual_accruals = models.JSONField(default=dict)  # факт Н
    actual_payments = models.JSONField(default=dict)  # факт О
    year = models.PositiveSmallIntegerField(
        default=timezone.now().year,
        db_index=True
    )
    responsible = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        verbose_name="Ответственный",
        related_name="works",
        on_delete=models.PROTECT,
        null=True,     # временно допускаем NULL, потом ужесточим
        blank=True,
    )
    # Ставка НДС: 0%, 5% или 20%
    VAT_CHOICES = [
        (0, "0%"),
        (5, "5%"),
        (20, "20%"),
    ]
    vat_rate = models.PositiveSmallIntegerField(
        "Ставка НДС",
        choices=VAT_CHOICES,
        default=0,
        help_text="Процент НДС"
    )

    FEASIBILITY_CHOICES = [
        ('green', 'Выполнима'),
        ('yellow', 'Вероятно выполнима'),
        ('red', 'Скорее не выполнима'),
    ]
    feasibility = models.CharField(
        "Возможность реализации",
        max_length=10,
        choices=FEASIBILITY_CHOICES,
        default='green',
    )

    class Meta:
        permissions = [
            (
                "change_any_work",
                "Can edit any work regardless of responsible user",
            ),
        ]

    def __str__(self):
        return self.name
# --- PaymentDetail model ---
class PaymentDetail(models.Model):
    """Дополнительные детали фактических оплат для работы"""
    work = models.ForeignKey(
        Work,
        related_name="payment_details",
        on_delete=models.CASCADE,
        verbose_name="Работа"
    )
    month = models.CharField(
        "Месяц",
        max_length=3,
        db_index=True
    )
    amount = models.DecimalField(
        "Сумма факта",
        max_digits=12,
        decimal_places=2
    )
    creditor = models.CharField(
        "Кредитор",
        max_length=255,
        blank=True
    )
    contract = models.CharField(
        "Договор",
        max_length=255,
        blank=True
    )
    pfm = models.CharField(
        "ПФМ",
        max_length=20,
        default="11000900"
    )
    fp = models.CharField(
        "ФП",
        max_length=50
    )
    mvz = models.CharField(
        "МВЗ",
        max_length=255,
        blank=True
    )
    mm = models.CharField(
        "ММ",
        max_length=255,
        blank=True
    )
    payment_document = models.CharField(
        "Документ на оплату",
        max_length=255,
        blank=True
    )
    payment_close = models.CharField(
        "Закрытие оплаты",
        max_length=255,
        blank=True
    )
    comment = models.TextField(
        "Комментарий",
        blank=True
    )
    comment_file = models.FileField(
        "Файл комментария",
        upload_to="payment_comments/",
        null=True,
        blank=True
    )
    # Причины отмены или переноса оплаты
    cancel_reason = models.TextField(
        "Причина отмены оплаты",
        blank=True
    )
    transfer_reason = models.TextField(
        "Причина переноса оплаты",
        blank=True
    )

    # Причина корректировки оплаты
    correction_reason = models.TextField(
        "Причина корректировки оплаты",
        blank=True
    )
    is_correction = models.BooleanField(
        "Корректировка",
        default=False
    )

    class Meta:
        verbose_name = "Деталь оплаты"
        verbose_name_plural = "Детали оплат"
        unique_together = ("work", "month")
        indexes = [
            models.Index(fields=['work', 'month']),
        ]

class AccrualDetail(models.Model):
    """Дополнительные детали фактических начислений для работы"""
    work = models.ForeignKey(
        Work,
        related_name="accrual_details",
        on_delete=models.CASCADE,
        verbose_name="Работа"
    )
    month = models.CharField(
        "Месяц",
        max_length=3,
        db_index=True
    )
    amount = models.DecimalField(
        "Сумма факта",
        max_digits=12,
        decimal_places=2
    )
    closing_document = models.CharField(
        "Документ закрытия",
        max_length=255,
        blank=True
    )
    comment = models.TextField(
        "Комментарий",
        blank=True
    )
    comment_file = models.FileField(
        "Файл комментария",
        upload_to="accrual_comments/",
        null=True,
        blank=True
    )
    # Причины отмены или переноса начисления
    cancel_reason = models.TextField(
        "Причина отмены",
        blank=True
    )
    transfer_reason = models.TextField(
        "Причина переноса",
        blank=True
    )

    # Причина корректировки начисления
    correction_reason = models.TextField(
        "Причина корректировки",
        blank=True
    )
    is_correction = models.BooleanField(
        "Корректировка",
        default=False
    )

    class Meta:
        verbose_name = "Деталь начисления"
        verbose_name_plural = "Детали начислений"
        unique_together = ("work", "month")
        indexes = [
            models.Index(fields=['work', 'month']),
        ]

    def __str__(self):
        return f"{self.work} [{self.month}] {self.amount}"

class Material(models.Model):
    work       = models.ForeignKey(Work, related_name="materials",
                                   on_delete=models.CASCADE)
    file       = models.FileField(upload_to="materials/%Y/%m/")
    uploaded_at = models.DateTimeField(auto_now_add=True)

# budget/models.py
class QuarterReserve(models.Model):
    QUARTERS = (
        (1, "I"), (2, "II"), (3, "III"), (4, "IV")
    )
    item        = models.ForeignKey(BudgetItem,
                                    related_name="reserves",
                                    on_delete=models.CASCADE)
    year        = models.PositiveSmallIntegerField()
    quarter     = models.PositiveSmallIntegerField(choices=QUARTERS)
    accrual_sum = models.DecimalField(max_digits=12, decimal_places=2, default=0)   # план
    payment_sum = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    used_acc    = models.DecimalField(max_digits=12, decimal_places=2, default=0)   # освоено
    used_pay    = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    class Meta:
        unique_together = ("item", "year", "quarter")