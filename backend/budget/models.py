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

    def __str__(self):
        return self.name


class Material(models.Model):
    work       = models.ForeignKey(Work, related_name="materials",
                                   on_delete=models.CASCADE)
    file       = models.FileField(upload_to="materials/%Y/%m/")
    uploaded_at = models.DateTimeField(auto_now_add=True)