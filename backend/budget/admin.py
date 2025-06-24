from django.contrib import admin
from .models import BudgetItem, Work, Material, QuarterReserve, Group

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
class WorkAdmin(admin.ModelAdmin):
    list_display = ("name", "item", "vat_rate")
    list_filter  = ("item", "vat_rate")
    search_fields = ("name",)
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