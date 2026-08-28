import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
import django
django.setup()

from apps.users.models import CustomUser, WalletAsset, Transaction

user = CustomUser.objects.filter(email='allvalleyacoustics@gmail.com').first()
if user:
    print(f'User: {user.email}')
    print(f'Public ID: {user.public_id}')
    print(f'Phone: {user.phone}')
    print(f'First Name: {user.first_name}')
    print(f'Last Name: {user.last_name}')
    print(f'Wallet Assets:')
    wallet_assets = WalletAsset.objects.filter(user=user)
    for wa in wallet_assets:
        print(f'  {wa.ticker}: {wa.quantity} (available: {wa.available_quantity})')
    transactions = Transaction.objects.filter(user=user)
    print(f'Transactions: {transactions.count()}')
    for tx in transactions[:10]:
        print(f'  {tx.created_at} - {tx.transaction_type} - {tx.asset} {tx.amount} - {tx.status}')
else:
    print('User not found')