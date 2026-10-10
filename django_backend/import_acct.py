import os
import sys
import django
import re
from pathlib import Path

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

EMAIL_PATTERN = re.compile(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', re.IGNORECASE)

def parse_contact_name(prefix: str):
    name = re.sub(r'^[\s\d.,;|:()<>\\-]+|[\s,;|:()<>\\-]+$', '', prefix)
    name = re.sub(r'\s+', ' ', name)
    if ',' in name:
        first_name, last_name = (part.strip() for part in name.split(',', 1))
        return first_name[:150], last_name[:150]
    parts = name.split()
    if not parts:
        return '', ''
    return parts[0][:150], ' '.join(parts[1:])[:150]

def username_for_email(email: str):
    email_slug = slugify(email)[:120] or 'contact'
    suffix = hashlib.sha256(email.encode('utf-8')).hexdigest()[:16]
    return f'{email_slug}-{suffix}'

def alias_for_email(base_email: str, idx=1):
    local, domain = base_email.rsplit('@', 1)
    return f'{local}+{idx}@{domain}'

def build_plan(source):
    plan = {}
    seen_base_emails = set()
    
    # Fetch all existing emails from DB at once for fast lookup
    print("  Fetching existing emails from database...")
    existing_emails = set(
        CustomUser.objects.values_list('email', flat=True)
    )
    print(f"  Found {len(existing_emails)} existing emails in database")
    sys.stdout.flush()
    
    with source.open('r', encoding='utf-8') as f:
        for line_num, line in enumerate(f, 1):
            if line_num % 500 == 0:
                print(f'  Processed {line_num} lines...')
                sys.stdout.flush()
            line = line.strip()
            if not line:
                continue
            
            emails = EMAIL_PATTERN.findall(line)
            if not emails:
                continue
            
            first_email = emails[0].lower()
            if len(emails) > 1:
                continue  # Multi-address rows: use only first, check duplicates separately
            
            prefix = line.split(emails[0])[0]
            first_name, last_name = parse_contact_name(prefix)
            
            if not first_name and not last_name:
                continue
            
            if first_email in seen_base_emails:
                continue
            
            seen_base_emails.add(first_email)
            alias_email = alias_for_email(first_email)
            
            # Check if already exists in database (using pre-fetched set)
            base_exists = first_email in existing_emails
            alias_exists = alias_email in existing_emails
            
            if base_exists and alias_exists:
                continue
            elif base_exists or alias_exists:
                continue
            
            plan[first_email] = ((first_name, last_name), alias_email)
    
    return plan


def import_batch(users_data):
    """Import a batch of users with their wallets."""
    from apps.users.models import CustomUser, WalletAsset, WalletAddress
    from apps.users.wallet_address import build_wallet_address
    from apps.users.signals import ASSET_DEFS
    from django.contrib.auth.hashers import make_password
    from django.db import transaction
    import hashlib
    
    password = os.environ.get('CRYPGO_IMPORT_INITIAL_PASSWORD', '')
    if not password:
        raise RuntimeError('Set CRYPGO_IMPORT_INITIAL_PASSWORD before importing accounts.')
    password_hash = make_password(password)
    
    # Fetch existing usernames for collision detection
    existing_usernames = set(CustomUser.objects.values_list('username', flat=True))
    
    def make_unique_username(email: str, existing: set) -> str:
        base = email.split('@')[0]
        username = base[:120]
        suffix = hashlib.sha256(email.encode('utf-8')).hexdigest()[:8]
        candidate = f'{username}-{suffix}'
        if candidate in existing:
            # Add a counter suffix
            counter = 1
            while f'{candidate}-{counter}' in existing:
                counter += 1
            candidate = f'{candidate}-{counter}'
        existing.add(candidate)
        return candidate
    
    users_to_create = []
    for email, (first_name, last_name), alias_email in users_data:
        users_to_create.append(CustomUser(
            username=make_unique_username(email, existing_usernames),
            email=email,
            password=password_hash,
            first_name=first_name,
            last_name=last_name,
            country='United States',
            is_active=True,
            role='user',
        ))
        users_to_create.append(CustomUser(
            username=make_unique_username(alias_email, existing_usernames),
            email=alias_email,
            password=password_hash,
            first_name=first_name,
            last_name=last_name,
            country='United States',
            is_active=True,
            role='user',
        ))
    
    print(f"    Creating {len(users_to_create)} users...")
    sys.stdout.flush()
    
    with transaction.atomic():
        created_users = CustomUser.objects.bulk_create(users_to_create, batch_size=100)
        print(f"    Created {len(created_users)} users")
        sys.stdout.flush()
        
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
        
        print(f"    Creating {len(wallet_assets)} wallet assets...")
        sys.stdout.flush()
        WalletAsset.objects.bulk_create(wallet_assets, batch_size=100)
        
        print(f"    Creating {len(wallet_addresses)} wallet addresses...")
        sys.stdout.flush()
        WalletAddress.objects.bulk_create(wallet_addresses, batch_size=100)
        
        print(f"    Batch complete!")
        sys.stdout.flush()
    
    return len(created_users)


def main():
    if not os.environ.get('CRYPGO_IMPORT_INITIAL_PASSWORD'):
        raise RuntimeError('Set CRYPGO_IMPORT_INITIAL_PASSWORD before importing accounts.')
    
    source = Path('C:/Users/User/Desktop/Crypgo/people.txt').resolve()
    if not source.is_file():
        print(f'Contact file not found: {source}')
        return
    
    print('Building plan...')
    plan = build_plan(source)
    total_accounts = sum(2 for _ in plan.values())  # 2 accounts per pair (base + alias)
    print(f'Planned new pairs: {len(plan)}; planned new accounts: {total_accounts}')
    
    if not plan:
        print('Nothing to create.')
        return
    
    print('Starting import...')
    batch_size = 100
    created_count = 0
    base_emails = list(plan.keys())
    
    for i in range(0, len(base_emails), batch_size):
        batch_emails = base_emails[i:i+batch_size]
        
        batch_data = []
        for base_email in batch_emails:
            (first_name, last_name), alias_email = plan[base_email]
            batch_data.append((base_email, (first_name, last_name), alias_email))
        
        if not batch_data:
            continue
        
        count = import_batch(batch_data)
        created_count += count
        print(f'Created {created_count} of {total_accounts} accounts...')
        sys.stdout.flush()
    
    from apps.users.models import WalletAsset as WA, WalletAddress as WADDR
    print(f'Total users: {CustomUser.objects.count()}')
    print(f'Total wallet assets: {WA.objects.count()}')
    print(f'Total wallet addresses: {WADDR.objects.count()}')
    print('Import completed!')


if __name__ == '__main__':
    main()