from django.contrib import admin
from .models import Category, Product, Customer, Sale, SaleItem, PrinterConfig, StoreSettings


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'icon', 'color', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'category', 'selling_price', 'stock_qty', 'is_active', 'is_favorite']
    list_filter = ['category', 'is_active', 'is_favorite']
    search_fields = ['name', 'barcode']


@admin.register(Customer)
class CustomerAdmin(admin.ModelAdmin):
    list_display = ['name', 'phone', 'email', 'created_at']
    search_fields = ['name', 'phone', 'email']


class SaleItemInline(admin.TabularInline):
    model = SaleItem
    extra = 0
    readonly_fields = ['total']


@admin.register(Sale)
class SaleAdmin(admin.ModelAdmin):
    list_display = ['invoice_no', 'customer', 'sale_date', 'total', 'payment_mode']
    list_filter = ['payment_mode', 'sale_date']
    search_fields = ['invoice_no']
    inlines = [SaleItemInline]
    readonly_fields = ['invoice_no', 'sale_date', 'created_at']


@admin.register(PrinterConfig)
class PrinterConfigAdmin(admin.ModelAdmin):
    list_display = ['name', 'printer_type', 'paper_width', 'is_default']


@admin.register(StoreSettings)
class StoreSettingsAdmin(admin.ModelAdmin):
    list_display = ['store_name', 'phone', 'gstin']
