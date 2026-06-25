from django.db import models


class Category(models.Model):
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=10, default='🛍️')
    color = models.CharField(max_length=20, default='#FF6B35')
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name_plural = 'Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Product(models.Model):
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True, blank=True, related_name='products')
    name = models.CharField(max_length=200)
    barcode = models.CharField(max_length=100, blank=True, null=True, unique=True)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=10, decimal_places=2)
    stock_qty = models.IntegerField(default=0)
    image = models.ImageField(upload_to='products/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    is_favorite = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Customer(models.Model):
    name = models.CharField(max_length=200)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    gstin = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.phone})"


class Sale(models.Model):
    PAYMENT_CHOICES = [
        ('CASH', 'Cash'),
        ('CARD', 'Card'),
        ('UPI', 'UPI'),
        ('CREDIT', 'Credit'),
    ]

    invoice_no = models.CharField(max_length=20, unique=True)
    customer = models.ForeignKey(Customer, on_delete=models.SET_NULL, null=True, blank=True, related_name='sales')
    sale_date = models.DateTimeField(auto_now_add=True)
    subtotal = models.DecimalField(max_digits=12, decimal_places=2)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    gst_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)
    payment_mode = models.CharField(max_length=10, choices=PAYMENT_CHOICES, default='CASH')
    notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-sale_date']

    def __str__(self):
        return self.invoice_no


class SaleItem(models.Model):
    sale = models.ForeignKey(Sale, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity = models.IntegerField()
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.product} x {self.quantity}"


class PrinterConfig(models.Model):
    PRINTER_TYPE_CHOICES = [
        ('BT', 'Bluetooth'),
        ('USB', 'USB'),
        ('WIFI', 'WiFi'),
    ]
    PAPER_WIDTH_CHOICES = [
        ('58', '58mm'),
        ('80', '80mm'),
    ]

    name = models.CharField(max_length=100)
    printer_type = models.CharField(max_length=5, choices=PRINTER_TYPE_CHOICES, default='BT')
    paper_width = models.CharField(max_length=5, choices=PAPER_WIDTH_CHOICES, default='80')
    printer_name = models.CharField(max_length=200, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    port = models.IntegerField(default=9100)
    is_default = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if self.is_default:
            PrinterConfig.objects.exclude(pk=self.pk).update(is_default=False)
        super().save(*args, **kwargs)


class StoreSettings(models.Model):
    store_name = models.CharField(max_length=200)
    address = models.TextField()
    phone = models.CharField(max_length=20)
    gstin = models.CharField(max_length=20, blank=True, null=True)
    gst_percent = models.DecimalField(max_digits=5, decimal_places=2, default=5)
    receipt_footer = models.CharField(max_length=200, default='Thank You! Visit Again Soon')
    logo = models.ImageField(upload_to='store/', blank=True, null=True)

    class Meta:
        verbose_name_plural = 'Store Settings'

    def __str__(self):
        return self.store_name

    @classmethod
    def get_settings(cls):
        obj, created = cls.objects.get_or_create(
            pk=1,
            defaults={
                'store_name': 'Jay Narayan Bakery',
                'address': 'Shop No. 5, Main Market, Rajkot, Gujarat 360001',
                'phone': '+91 7984178801',
                'gst_percent': 5,
                'receipt_footer': 'Thank You! Visit Again Soon',
            }
        )
        return obj
