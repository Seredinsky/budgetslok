# budget/migrations/0007_fill_groups_and_relink.py
from django.db import migrations

def create_groups_and_relink(apps, schema_editor):
    Group      = apps.get_model('budget', 'Group')
    BudgetItem = apps.get_model('budget', 'BudgetItem')

    # 1) создаём справочник групп
    g1, _ = Group.objects.get_or_create(
        code='cert',
        defaults={'name': 'Расходы на сертификацию, патентование и метрологию, качество'}
    )
    g2, _ = Group.objects.get_or_create(
        code='general',
        defaults={'name': 'Общехозяйственные расходы'}
    )
    g3, _ = Group.objects.get_or_create(
        code='invest',
        defaults={'name': 'Инвестиции'}
    )

    # 2) привязываем все старые BudgetItem к новым группам
    for bi in BudgetItem.objects.all():
        old = bi.group  # это ещё CharField
        if old == 'cert':
            bi.group = g1
        elif old == 'general':
            bi.group = g2
        elif old == 'invest':
            bi.group = g3
        bi.save()

class Migration(migrations.Migration):
    dependencies = [
        ('budget', '0007_group_alter_budgetitem_group') # замените на точную предшествующую миграцию
    ]

    operations = [
        migrations.RunPython(create_groups_and_relink, reverse_code=migrations.RunPython.noop),
    ]