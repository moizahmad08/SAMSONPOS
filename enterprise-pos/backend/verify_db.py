import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute('SELECT DATABASE();')
    db_name = cursor.fetchone()[0]
    print(f'Connected database: {db_name}')
