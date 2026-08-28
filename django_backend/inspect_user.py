import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

django.setup()

from apps.users.models import CustomUser, WalletAsset, Transaction

user = CustomUser.objects.filter(email='allvalleyacoustics@gmail.com').first()
if not user:
    print("USER NOT FOUND")
    sys.exit(1)

print(f'User: {user.email}')
print(f'Username: {user.username}')
print(f'First: {user.first_name}')
print(f'Last: {user.last_name}')
print(f'Phone: {user.phone}')
print(f'Country: {user.country}')
print(f'City: {user.city}')
print(f'Address: {user.address}')
print(f'Date Joined: {user.date_joined}')
print(f'KYC: {user.kyc_status}')
print(f'Role: {user.role}')
print()

assets = WalletAsset.objects.filter(user=user)
print('Assets:')
for a in assets:
    print(f'  {a.ticker} ({a.name}): {a.quantity} avail:{a.available_quantity}')
print()

txs = Transaction.objects.filter(user=user).order_by('-created_at')
print(f'Transactions: {txs.count()}')
for t in txs[:15]:
    print(f'  {t.created_at.strftime("%Y-%m-%d %H:%M")} | {t.get_transaction_type_display():12} | {t.asset} {t.amount} | {t.status} | fiat:{t.fiat_amount} price:{t.price_at_time}')