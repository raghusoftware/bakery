import json
from decimal import Decimal
from datetime import date, timedelta
from django.shortcuts import render
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db.models import Sum, Count, Q
from django.utils import timezone
from .models import Category, Product, Customer, Sale, SaleItem, StoreSettings, PrinterConfig


def get_store_settings():
    return StoreSettings.get_settings()


# ─── Page Views ──────────────────────────────────────────────────────────────

def dashboard_view(request):
    settings = get_store_settings()
    return render(request, 'pos/dashboard.html', {'store': settings})


def pos_view(request):
    settings = get_store_settings()
    return render(request, 'pos/pos.html', {'store': settings})


def products_view(request):
    settings = get_store_settings()
    categories = Category.objects.filter(is_active=True)
    return render(request, 'pos/products.html', {'store': settings, 'categories': categories})


def customers_view(request):
    settings = get_store_settings()
    return render(request, 'pos/customers.html', {'store': settings})


def sales_view(request):
    settings = get_store_settings()
    return render(request, 'pos/sales.html', {'store': settings})


def reports_view(request):
    settings = get_store_settings()
    return render(request, 'pos/reports.html', {'store': settings})


def settings_view(request):
    store = get_store_settings()
    printers = PrinterConfig.objects.all()
    return render(request, 'pos/settings.html', {'store': store, 'printers': printers})


# ─── API Views ────────────────────────────────────────────────────────────────

@require_http_methods(['GET', 'POST'])
@csrf_exempt
def api_products(request):
    if request.method == 'GET':
        products = Product.objects.filter(is_active=True).select_related('category')
        data = []
        for p in products:
            data.append({
                'id': p.id,
                'name': p.name,
                'barcode': p.barcode or '',
                'selling_price': str(p.selling_price),
                'purchase_price': str(p.purchase_price),
                'stock_qty': p.stock_qty,
                'is_favorite': p.is_favorite,
                'image': p.image.url if p.image else '',
                'category': {
                    'id': p.category.id if p.category else None,
                    'name': p.category.name if p.category else '',
                    'icon': p.category.icon if p.category else '',
                    'color': p.category.color if p.category else '#FF6B35',
                }
            })
        return JsonResponse({'products': data})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            category = None
            if data.get('category_id'):
                category = Category.objects.get(id=data['category_id'])
            product = Product.objects.create(
                name=data['name'],
                category=category,
                barcode=data.get('barcode') or None,
                purchase_price=Decimal(str(data.get('purchase_price', 0))),
                selling_price=Decimal(str(data['selling_price'])),
                stock_qty=int(data.get('stock_qty', 0)),
                is_favorite=data.get('is_favorite', False),
            )
            return JsonResponse({'id': product.id, 'name': product.name}, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


def api_products_search(request):
    q = request.GET.get('q', '').strip()
    if not q:
        return JsonResponse({'products': []})
    products = Product.objects.filter(
        is_active=True
    ).filter(
        Q(name__icontains=q) | Q(barcode__iexact=q)
    ).select_related('category')[:20]
    data = [{
        'id': p.id,
        'name': p.name,
        'barcode': p.barcode or '',
        'selling_price': str(p.selling_price),
        'stock_qty': p.stock_qty,
        'category': {'name': p.category.name if p.category else '', 'icon': p.category.icon if p.category else ''},
    } for p in products]
    return JsonResponse({'products': data})


def api_categories(request):
    categories = Category.objects.filter(is_active=True)
    data = [{'id': c.id, 'name': c.name, 'icon': c.icon, 'color': c.color} for c in categories]
    return JsonResponse({'categories': data})


@require_http_methods(['GET', 'POST'])
@csrf_exempt
def api_customers(request):
    if request.method == 'GET':
        q = request.GET.get('q', '')
        customers = Customer.objects.all()
        if q:
            customers = customers.filter(Q(name__icontains=q) | Q(phone__icontains=q))
        data = [{'id': c.id, 'name': c.name, 'phone': c.phone, 'email': c.email or '', 'gstin': c.gstin or ''} for c in customers[:50]]
        return JsonResponse({'customers': data})
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            customer = Customer.objects.create(
                name=data['name'],
                phone=data['phone'],
                email=data.get('email') or None,
                address=data.get('address') or None,
                gstin=data.get('gstin') or None,
            )
            return JsonResponse({'id': customer.id, 'name': customer.name, 'phone': customer.phone}, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


def _generate_invoice_no():
    last_sale = Sale.objects.order_by('-id').first()
    if last_sale:
        try:
            num = int(last_sale.invoice_no.split('-')[1]) + 1
        except Exception:
            num = 1
    else:
        num = 1
    return f'INV-{num:04d}'


@require_http_methods(['GET', 'POST'])
@csrf_exempt
def api_sales(request):
    if request.method == 'GET':
        date_from = request.GET.get('from')
        date_to = request.GET.get('to')
        sales = Sale.objects.select_related('customer').order_by('-sale_date')
        if date_from:
            sales = sales.filter(sale_date__date__gte=date_from)
        if date_to:
            sales = sales.filter(sale_date__date__lte=date_to)
        data = []
        for s in sales[:100]:
            data.append({
                'id': s.id,
                'invoice_no': s.invoice_no,
                'customer': s.customer.name if s.customer else 'Walk-in',
                'sale_date': s.sale_date.strftime('%d/%m/%Y %I:%M %p'),
                'subtotal': str(s.subtotal),
                'discount': str(s.discount),
                'gst_amount': str(s.gst_amount),
                'total': str(s.total),
                'payment_mode': s.payment_mode,
            })
        return JsonResponse({'sales': data})

    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            store = get_store_settings()
            subtotal = Decimal(str(data['subtotal']))
            discount = Decimal(str(data.get('discount', 0)))
            gst_percent = Decimal(str(data.get('gst_percent', store.gst_percent)))
            taxable = subtotal - discount
            gst_amount = (taxable * gst_percent / 100).quantize(Decimal('0.01'))
            total = taxable + gst_amount

            customer = None
            if data.get('customer_id'):
                try:
                    customer = Customer.objects.get(id=data['customer_id'])
                except Customer.DoesNotExist:
                    pass

            invoice_no = _generate_invoice_no()
            sale = Sale.objects.create(
                invoice_no=invoice_no,
                customer=customer,
                subtotal=subtotal,
                discount=discount,
                gst_percent=gst_percent,
                gst_amount=gst_amount,
                total=total,
                payment_mode=data.get('payment_mode', 'CASH'),
                notes=data.get('notes', ''),
            )

            items_data = []
            for item in data.get('items', []):
                product = Product.objects.get(id=item['product_id'])
                qty = int(item['quantity'])
                unit_price = Decimal(str(item['unit_price']))
                item_total = unit_price * qty
                SaleItem.objects.create(
                    sale=sale,
                    product=product,
                    quantity=qty,
                    unit_price=unit_price,
                    total=item_total,
                )
                # Deduct stock
                product.stock_qty = max(0, product.stock_qty - qty)
                product.save(update_fields=['stock_qty'])
                items_data.append({
                    'name': product.name,
                    'quantity': qty,
                    'unit_price': str(unit_price),
                    'total': str(item_total),
                })

            return JsonResponse({
                'id': sale.id,
                'invoice_no': sale.invoice_no,
                'sale_date': sale.sale_date.strftime('%d/%m/%Y %I:%M %p'),
                'customer': customer.name if customer else 'Walk-in Customer',
                'subtotal': str(sale.subtotal),
                'discount': str(sale.discount),
                'gst_percent': str(sale.gst_percent),
                'gst_amount': str(sale.gst_amount),
                'total': str(sale.total),
                'payment_mode': sale.payment_mode,
                'items': items_data,
                'store': {
                    'name': store.store_name,
                    'address': store.address,
                    'phone': store.phone,
                    'footer': store.receipt_footer,
                }
            }, status=201)
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


def api_sale_detail(request, sale_id):
    try:
        sale = Sale.objects.select_related('customer').prefetch_related('items__product').get(id=sale_id)
        store = get_store_settings()
        items = []
        for item in sale.items.all():
            items.append({
                'name': item.product.name if item.product else 'Deleted Product',
                'quantity': item.quantity,
                'unit_price': str(item.unit_price),
                'total': str(item.total),
            })
        return JsonResponse({
            'id': sale.id,
            'invoice_no': sale.invoice_no,
            'sale_date': sale.sale_date.strftime('%d/%m/%Y %I:%M %p'),
            'customer': sale.customer.name if sale.customer else 'Walk-in Customer',
            'customer_phone': sale.customer.phone if sale.customer else '',
            'subtotal': str(sale.subtotal),
            'discount': str(sale.discount),
            'gst_percent': str(sale.gst_percent),
            'gst_amount': str(sale.gst_amount),
            'total': str(sale.total),
            'payment_mode': sale.payment_mode,
            'notes': sale.notes or '',
            'items': items,
            'store': {
                'name': store.store_name,
                'address': store.address,
                'phone': store.phone,
                'footer': store.receipt_footer,
            }
        })
    except Sale.DoesNotExist:
        return JsonResponse({'error': 'Sale not found'}, status=404)


def api_dashboard(request):
    today = date.today()
    today_sales = Sale.objects.filter(sale_date__date=today)
    today_count = today_sales.count()
    today_revenue = today_sales.aggregate(total=Sum('total'))['total'] or 0
    today_items = SaleItem.objects.filter(sale__sale_date__date=today).aggregate(qty=Sum('quantity'))['qty'] or 0

    week_ago = today - timedelta(days=6)
    week_data = []
    for i in range(7):
        d = week_ago + timedelta(days=i)
        rev = Sale.objects.filter(sale_date__date=d).aggregate(total=Sum('total'))['total'] or 0
        week_data.append({'date': d.strftime('%a'), 'revenue': float(rev)})

    top_products = SaleItem.objects.filter(
        sale__sale_date__date=today
    ).values('product__name').annotate(
        qty=Sum('quantity'), revenue=Sum('total')
    ).order_by('-qty')[:5]

    recent_sales = Sale.objects.select_related('customer').order_by('-sale_date')[:10]
    recent = [{
        'invoice_no': s.invoice_no,
        'customer': s.customer.name if s.customer else 'Walk-in',
        'total': str(s.total),
        'payment_mode': s.payment_mode,
        'sale_date': s.sale_date.strftime('%I:%M %p'),
    } for s in recent_sales]

    return JsonResponse({
        'today_sales': today_count,
        'today_revenue': float(today_revenue),
        'today_items': today_items,
        'week_data': week_data,
        'top_products': list(top_products),
        'recent_sales': recent,
    })


@require_http_methods(['GET', 'POST'])
@csrf_exempt
def api_settings(request):
    store = get_store_settings()
    if request.method == 'GET':
        return JsonResponse({
            'store_name': store.store_name,
            'address': store.address,
            'phone': store.phone,
            'gstin': store.gstin or '',
            'gst_percent': str(store.gst_percent),
            'receipt_footer': store.receipt_footer,
        })
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            store.store_name = data.get('store_name', store.store_name)
            store.address = data.get('address', store.address)
            store.phone = data.get('phone', store.phone)
            store.gstin = data.get('gstin') or None
            store.gst_percent = Decimal(str(data.get('gst_percent', store.gst_percent)))
            store.receipt_footer = data.get('receipt_footer', store.receipt_footer)
            store.save()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)


@require_http_methods(['GET', 'POST'])
@csrf_exempt
def api_products_update(request, product_id):
    try:
        product = Product.objects.get(id=product_id)
    except Product.DoesNotExist:
        return JsonResponse({'error': 'Not found'}, status=404)

    if request.method == 'GET':
        return JsonResponse({
            'id': product.id,
            'name': product.name,
            'barcode': product.barcode or '',
            'selling_price': str(product.selling_price),
            'purchase_price': str(product.purchase_price),
            'stock_qty': product.stock_qty,
            'is_favorite': product.is_favorite,
            'is_active': product.is_active,
            'category_id': product.category_id,
        })
    elif request.method == 'POST':
        try:
            data = json.loads(request.body)
            for field in ['name', 'barcode', 'selling_price', 'purchase_price', 'stock_qty', 'is_favorite', 'is_active']:
                if field in data:
                    setattr(product, field, data[field])
            if 'category_id' in data and data['category_id']:
                product.category_id = data['category_id']
            product.save()
            return JsonResponse({'success': True})
        except Exception as e:
            return JsonResponse({'error': str(e)}, status=400)
