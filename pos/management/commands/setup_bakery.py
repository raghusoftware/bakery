from django.core.management.base import BaseCommand
from pos.models import Category, Product, StoreSettings


class Command(BaseCommand):
    help = 'Set up initial bakery data'

    def handle(self, *args, **options):
        self.stdout.write('Setting up Jay Narayan Bakery...')

        # Store settings
        store, created = StoreSettings.objects.update_or_create(
            pk=1,
            defaults={
                'store_name': 'Jay Narayan Bakery',
                'address': 'Shop No. 5, Main Market, Rajkot, Gujarat 360001',
                'phone': '+91 7984178801',
                'gstin': '24XXXXX1234X1ZX',
                'gst_percent': 5,
                'receipt_footer': 'Thank You! Visit Again Soon',
            }
        )
        self.stdout.write(self.style.SUCCESS(f'{"Created" if created else "Updated"} store settings'))

        # Categories
        categories_data = [
            ('Bread', '🍞', '#FF6B35'),
            ('Cakes', '🎂', '#E74C3C'),
            ('Cookies', '🍪', '#F39C12'),
            ('Drinks', '☕', '#3498DB'),
            ('Snacks', '🥐', '#27AE60'),
        ]
        categories = {}
        for name, icon, color in categories_data:
            cat, created = Category.objects.get_or_create(
                name=name,
                defaults={'icon': icon, 'color': color, 'is_active': True}
            )
            categories[name] = cat
            self.stdout.write(f'  {"Created" if created else "Exists"} category: {name}')

        # Products
        products_data = [
            ('White Bread Loaf', 'Bread', 18, 35, 50),
            ('Brown Bread Loaf', 'Bread', 22, 45, 40),
            ('Garlic Bread', 'Bread', 30, 60, 30),
            ('Black Forest Cake', 'Cakes', 150, 280, 10),
            ('Pineapple Pastry', 'Cakes', 25, 50, 20),
            ('Butter Cookies (Pack)', 'Cookies', 40, 80, 35),
            ('Chocolate Chip Cookies', 'Cookies', 45, 90, 25),
            ('Masala Chai', 'Drinks', 8, 20, 100),
            ('Cold Coffee', 'Drinks', 30, 70, 50),
            ('Samosa (2 pcs)', 'Snacks', 12, 25, 60),
        ]

        for name, cat_name, purchase, selling, stock in products_data:
            prod, created = Product.objects.get_or_create(
                name=name,
                defaults={
                    'category': categories[cat_name],
                    'purchase_price': purchase,
                    'selling_price': selling,
                    'stock_qty': stock,
                    'is_active': True,
                    'is_favorite': selling <= 50,
                }
            )
            self.stdout.write(f'  {"Created" if created else "Exists"} product: {name}')

        self.stdout.write(self.style.SUCCESS('\nSetup complete! Jay Narayan Bakery is ready.'))
        self.stdout.write('Run: python manage.py runserver')
        self.stdout.write('Then open: http://localhost:8000/')
