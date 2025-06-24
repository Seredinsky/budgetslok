from django.db import models
from django.utils import timezone

class BudgetItem(models.Model):
    """Статья бюджета (ИТ-Инфраструктура, Маркетинг …)"""
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name


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
    responsible = models.CharField(
        "Ответственный (ФИО)", max_length=120, blank=True
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