from django.db import migrations

def create_groups_and_relink(apps, schema_editor):
    Group      = apps.get_model('budget', 'Group')
    BudgetItem = apps.get_model('budget', 'BudgetItem')

    # 1. создаём справочник
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

    # 2. привязываем BudgetItem к новым группам
    for bi in BudgetItem.objects.all():
        old = bi.group  # до миграции это ещё CharField
        if old == 'cert':
            bi.group = str(g1.pk)
        elif old == 'general':
            bi.group = str(g2.pk)
        elif old == 'invest':
            bi.group = str(g3.pk)
        bi.save()

class Migration(migrations.Migration):
    dependencies = [
        ('budget', '0007_group_alter_budgetitem_group'),
    ]

    operations = [
        migrations.RunPython(create_groups_and_relink, reverse_code=migrations.RunPython.noop),
    ]