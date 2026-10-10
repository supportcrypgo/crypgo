import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
sys.path.insert(0, '.')
django.setup()

from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.utils.text import slugify
import hashlib

from apps.users.models import CustomUser, WalletAsset, WalletAddress
from apps.users.wallet_address import build_wallet_address
from apps.users.signals import ASSET_DEFS

print(f"ASSET_DEFS: {ASSET_DEFS}")
print(f"Number of assets: {len(ASSET_DEFS)}")

# Test creating 2 users with wallets
password = os.environ.get('CRYPGO_IMPORT_INITIAL_PASSWORD', '')
if not password:
    raise RuntimeError('Set CRYPGO_IMPORT_INITIAL_PASSWORD before creating test accounts.')
password_hash = make_password(password)

test_users = [
    ('test1@example.com', 'Test', 'One'),
    ('test2@example.com', 'Test', 'Two'),
]

users_to_create = []
for email, fn, ln in test_users:
    users_to_create.append(CustomUser(
        username=email.split('@')[0],
        email=email,
        password=password_hash,
        first_name=fn,
        last_name=ln,
        country='United States',
        is_active=True,
        role='user',
    ))

print(f"Creating {len(users_to_create)} test users...")
with transaction.atomic():
    created_users = CustomUser.objects.bulk_create(users_to_create, batch_size=10)
    print(f"Created users: {[u.email for u in created_users]}")
    
    wallet_assets = []
    wallet_addresses = []
    for user in created_users:
        for ticker, name in ASSET_DEFS:
            wallet_assets.append(WalletAsset(
                user=user,
                ticker=ticker,
                name=name,
                quantity=0,
                available_quantity=0,
                locked_quantity=0,
            ))
            wallet_addresses.append(WalletAddress(
                user=user,
                ticker=ticker,
                network='mainnet',
                address=build_wallet_address(user.pk, ticker),
            ))
    
    print(f"Creating {len(wallet_assets)} wallet assets...")
    WalletAsset.objects.bulk_create(wallet_assets, batch_size=50)
    print(f"Creating {len(wallet_addresses)} wallet addresses...")
    WalletAddress.objects.bulk_create(wallet_addresses, batch_size=50)
    print("Done!")

from apps.users.models import WalletAsset as WA, WalletAddress as WADDR
print(f"Total users: {CustomUser.objects.count()}")
print(f"Total wallet assets: {WA.objects.count()}")
print(f"Total wallet addresses: {WADDR.objects.count()}")