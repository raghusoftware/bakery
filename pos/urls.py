from django.urls import path
from . import views

urlpatterns = [
    # Page views
    path('', views.dashboard_view, name='dashboard'),
    path('pos/', views.pos_view, name='pos'),
    path('products/', views.products_view, name='products'),
    path('customers/', views.customers_view, name='customers'),
    path('sales/', views.sales_view, name='sales'),
    path('reports/', views.reports_view, name='reports'),
    path('settings/', views.settings_view, name='settings'),

    # API endpoints
    path('api/products/', views.api_products, name='api_products'),
    path('api/products/search/', views.api_products_search, name='api_products_search'),
    path('api/products/<int:product_id>/', views.api_products_update, name='api_products_update'),
    path('api/categories/', views.api_categories, name='api_categories'),
    path('api/customers/', views.api_customers, name='api_customers'),
    path('api/sales/', views.api_sales, name='api_sales'),
    path('api/sales/<int:sale_id>/', views.api_sale_detail, name='api_sale_detail'),
    path('api/dashboard/', views.api_dashboard, name='api_dashboard'),
    path('api/settings/', views.api_settings, name='api_settings'),
]
