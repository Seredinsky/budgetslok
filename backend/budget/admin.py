from django.contrib import admin
from import_export import resources
from import_export.admin import ImportExportModelAdmin
from import_export import fields
from import_export.widgets import ForeignKeyWidget, JSONWidget
import json
from json import JSONDecodeError
from .models import BudgetItem, Work, Material, QuarterReserve, Group
from .models import BudgetItem

class WorkResource(resources.ModelResource):
    class JsonSplitWidget(JSONWidget):
        def clean(self, data, row=None, *args, **kwargs):
            if not data:
                return {}
            try:
                return json.loads(data)
            except JSONDecodeError:
                return {}

    item = fields.Field(
        column_name='item',
        attribute='item',
        widget=ForeignKeyWidget(BudgetItem, 'name')
    )
    # Split accruals JSON
    accruals_month = fields.Field(column_name='accruals_month', attribute='accruals')
    accruals_amount = fields.Field(column_name='accruals_amount', attribute='accruals')
    accruals_status = fields.Field(column_name='accruals_status', attribute='accruals')
    # Split payments JSON
    payments_month = fields.Field(column_name='payments_month', attribute='payments')
    payments_amount = fields.Field(column_name='payments_amount', attribute='payments')
    payments_status = fields.Field(column_name='payments_status', attribute='payments')
    # Split actual_accruals JSON
    actual_accruals_month = fields.Field(column_name='actual_accruals_month', attribute='actual_accruals')
    actual_accruals_amount = fields.Field(column_name='actual_accruals_amount', attribute='actual_accruals')
    actual_accruals_status = fields.Field(column_name='actual_accruals_status', attribute='actual_accruals')
    # Split actual_payments JSON
    actual_payments_month = fields.Field(column_name='actual_payments_month', attribute='actual_payments')
    actual_payments_amount = fields.Field(column_name='actual_payments_amount', attribute='actual_payments')
    actual_payments_status = fields.Field(column_name='actual_payments_status', attribute='actual_payments')

    # JSON fields for import
    accruals = fields.Field(
        column_name='accruals',
        attribute='accruals',
        widget=JsonSplitWidget()
    )
    payments = fields.Field(
        column_name='payments',
        attribute='payments',
        widget=JsonSplitWidget()
    )
    actual_accruals = fields.Field(
        column_name='actual_accruals',
        attribute='actual_accruals',
        widget=JsonSplitWidget()
    )
    actual_payments = fields.Field(
        column_name='actual_payments',
        attribute='actual_payments',
        widget=JsonSplitWidget()
    )

    def dehydrate_accruals_month(self, work):
        raw = work.accruals
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        return next(iter(data.keys()), '')

    def dehydrate_accruals_amount(self, work):
        raw = work.accruals
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('amount', '') if key else ''

    def dehydrate_accruals_status(self, work):
        raw = work.accruals
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('status', '') if key else ''

    def dehydrate_payments_month(self, work):
        raw = work.payments
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        return next(iter(data.keys()), '')

    def dehydrate_payments_amount(self, work):
        raw = work.payments
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('amount', '') if key else ''

    def dehydrate_payments_status(self, work):
        raw = work.payments
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('status', '') if key else ''

    def dehydrate_actual_accruals_month(self, work):
        raw = work.actual_accruals
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        return next(iter(data.keys()), '')

    def dehydrate_actual_accruals_amount(self, work):
        raw = work.actual_accruals
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('amount', '') if key else ''

    def dehydrate_actual_accruals_status(self, work):
        raw = work.actual_accruals
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('status', '') if key else ''

    def dehydrate_actual_payments_month(self, work):
        raw = work.actual_payments
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        return next(iter(data.keys()), '')

    def dehydrate_actual_payments_amount(self, work):
        raw = work.actual_payments
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('amount', '') if key else ''

    def dehydrate_actual_payments_status(self, work):
        raw = work.actual_payments
        try:
            data = json.loads(raw) if isinstance(raw, str) else raw or {}
        except JSONDecodeError:
            data = {}
        key = next(iter(data.keys()), None)
        return data[key].get('status', '') if key else ''

    def before_import_row(self, row, **kwargs):
        for prefix in ['accruals', 'payments', 'actual_accruals', 'actual_payments']:
            month = row.get(f'{prefix}_month')
            amount = row.get(f'{prefix}_amount')
            status = row.get(f'{prefix}_status')
            if month:
                obj = {month: {'amount': amount, 'status': status}}
            else:
                obj = {}
            row[prefix] = json.dumps(obj, ensure_ascii=False)

    class Meta:
        model = Work
        import_id_fields = ('id',)
        # Required for import: id, item, name; other fields are optional
        fields = (
            'id', 'item', 'name', 'justification', 'comment',
            'certification', 'work_type', 'product_name',
            'responsible_slok', 'responsible_dpm',
            'certificate_number', 'certification_body',
            'accruals_month', 'accruals_amount', 'accruals_status',
            'payments_month', 'payments_amount', 'payments_status',
            'actual_accruals_month', 'actual_accruals_amount', 'actual_accruals_status',
            'actual_payments_month', 'actual_payments_amount', 'actual_payments_status',
            'accruals', 'payments', 'actual_accruals', 'actual_payments',
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