from django.db import models
from django.utils import timezone
from django.conf import settings

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
    item = models.ForeignKey(BudgetItem, related_name="works",
                             on_delete=models.CASCADE)
    name = models.CharField(max_length=200)
    justification = models.TextField(blank=True)
    comment = models.TextField(blank=True)

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