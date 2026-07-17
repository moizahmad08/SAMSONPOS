import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth.models import User

username = "muhammad"
password = "mady1122"
email = "admin@example.com"

try:
    if not User.objects.filter(username=username).exists():
        User.objects.create_superuser(username, email, password)
        print(f"Superuser '{username}' created successfully!")
    else:
        # Update the password in case it needs to be reset/changed
        user = User.objects.get(username=username)
        user.set_password(password)
        user.is_superuser = True
        user.is_staff = True
        user.save()
        print(f"Superuser '{username}' password updated successfully!")
except Exception as e:
    print(f"Could not create/update superuser: {e}")
