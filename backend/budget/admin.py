from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export import fields
from import_export.widgets import ForeignKeyWidget
from .models import BudgetItem, Work, Material, QuarterReserve, Group
from .models import BudgetItem

class WorkResource(resources.ModelResource):
    item = fields.Field(
        column_name='item',
        attribute='item',
        widget=ForeignKeyWidget(BudgetItem, 'name')
    )
    class Meta:
        model = Work
        import_id_fields = ('id',)
        # Required for import: id, item, name; other fields are optional
        fields = (
            'id', 'item', 'name', 'justification', 'comment',
            'certification', 'work_type', 'product_name',
            'responsible_slok', 'responsible_dpm',
            'certificate_number', 'certification_body',
            'accruals', 'payments',
            'actual_accruals', 'actual_payments',
            'year', 'responsible', 'vat_rate', 'feasibility',
        )
        export_order = fields

class MaterialInline(admin.TabularInline):
    model = Material
    fk_name = "work"
    extra = 0

class WorkInline(admin.TabularInline):
    model = Work
    fk_name = "item"
    extra = 0

@admin.register(BudgetItem)
class BudgetItemAdmin(admin.ModelAdmin):
    list_display = ("position", "name", "group")
    list_display_links = ("name",)
    list_editable = ("position",)
    ordering = ("position",)
    list_filter = ("group",)
    inlines = [WorkInline]

@admin.register(Work)
class WorkAdmin(ImportExportModelAdmin):
    resource_class = WorkResource
    list_display = ("name", "item", "vat_rate", "responsible", "feasibility", "year")
    list_filter  = ("item", "vat_rate", "responsible", "feasibility", "year")
    search_fields = (
        "name",
        "responsible__username",
        "responsible__first_name",
        "responsible__last_name",
    )
    autocomplete_fields = ("responsible",)
    inlines = [MaterialInline]

@admin.register(QuarterReserve)
class QuarterReserveAdmin(admin.ModelAdmin):
    list_display = (
        "item",
        "year",
        "quarter",
        "accrual_sum",
        "payment_sum",
        "used_acc",
        "used_pay",
    )
    list_filter = ("item", "year", "quarter")
    search_fields = ("item__name",)

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ("code", "name")
    search_fields = ("code", "name")