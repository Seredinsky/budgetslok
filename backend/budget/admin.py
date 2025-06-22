from django.contrib import admin
from .models import BudgetItem, Work, Material

class MaterialInline(admin.TabularInline):
    model = Material
    extra = 0

class WorkInline(admin.TabularInline):
    model = Work
    extra = 0

@admin.register(BudgetItem)
class BudgetItemAdmin(admin.ModelAdmin):
    inlines = [WorkInline]

@admin.register(Work)
class WorkAdmin(admin.ModelAdmin):
    list_display = ("name", "item", "year", "responsible")
    list_filter  = ("year",)
    search_fields = ("name", "responsible")
    inlines = [MaterialInline]