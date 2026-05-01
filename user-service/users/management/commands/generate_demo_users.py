from django.core.management.base import BaseCommand
from users.models import User
import random

class Command(BaseCommand):
    help = 'Generate demo users for the admin panel'

    def handle(self, *args, **kwargs):
        names = ["Alice Smith", "Bob Jones", "Charlie Brown", "Diana Prince", "Eve Adams", "Frank Castle", "Grace Hopper", "Hank Pym", "Ivy Pepper", "Jack Shephard"]
        
        count = 0
        for name in names:
            email = f"{name.split()[0].lower()}@rentpi.demo"
            if not User.objects.filter(email=email).exists():
                user = User(name=name, email=email)
                user.set_password("demo1234")
                user.save()
                count += 1
                
        # Also ensure an admin user exists
        if not User.objects.filter(email="admin@rentpi.com").exists():
            admin = User(name="Admin User", email="admin@rentpi.com")
            admin.set_password("admin123")
            admin.save()
            self.stdout.write(self.style.SUCCESS('Successfully created admin user.'))

        self.stdout.write(self.style.SUCCESS(f'Successfully generated {count} demo users.'))
