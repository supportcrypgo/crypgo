#!/usr/bin/env python
"""
Django management command to create Matt Frewer user account.
Clones the pattern used for the 256 other users.
"""

import os
import sys
import django
import datetime

# Add the Django project path to sys.path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone
from datetime import timedelta
from decimal import Decimal

from apps.users.models import CustomUser, Transaction, WalletAsset


# Matt Frewer's account details
USER_DATA = {
    'email': 'sirmattfrewer@gmail.com',
    'username': 'sirmattfrewer',
    'first_name': 'Matt',
    'last_name': 'Frewer',
    'phone': '+1 212-722-5900',
    'country': 'United States',
    'password': 'password123',
    'is_active': True,
}

# Historical prices from December 2012
PRICES_2012 = {
    'BTC': Decimal('13.50'),       # ~$13.50 per BTC in Dec 2012
    'ETH': Decimal('0.50'),        # ~$0.50 per ETH in Dec 2012
    'SOL': Decimal('0.00'),        # SOL didn't exist in 2012
}


class Command(BaseCommand):
    help = 'Create Matt Frewer user account with historical data'

    def handle(self, *args, **options):
        """Create Matt Frewer's account with historical data."""
        
        self.stdout.write("Creating Matt Frewer account...")
        
        with transaction.atomic():
            # 1. Create user
            try:
                user = CustomUser.objects.create_user(
                    email=USER_DATA['email'],
                    username=USER_DATA['username'],
                    first_name=USER_DATA['first_name'],
                    last_name=USER_DATA['last_name'],
                    phone=USER_DATA['phone'],
                    country=USER_DATA['country'],
                    is_active=USER_DATA['is_active'],
                    password=USER_DATA['password']
                )
                self.stdout.write("[OK] User created: {user.email}".format(user=user))
                self.stdout.write("  Public ID: {user.public_id}".format(user=user))
                self.stdout.write("  Role: {user.role}".format(user=user))
            except Exception as e:
                self.stdout.write("[ERROR] Error creating user: {e}".format(e=e))
                return False
            
            # 2. Generate 10 receive transactions (Dec 2012 pattern)
            # Total fiat amount should be around $450
            transaction_count = 10
            total_fiat = Decimal('450.00')
            
            self.stdout.write(f"\nCreating {transaction_count} historical receive transactions...")
            tx_counter = int(datetime.datetime.now().strftime('%H%M%S'))
            
            # Transaction patterns matching the 256 users - total $450
            transactions_data = [
                {'asset': 'BTC', 'amount': Decimal('1.66666667'), 'fiat': Decimal('22.50')},
                {'asset': 'BTC', 'amount': Decimal('1.66666667'), 'fiat': Decimal('22.50')},
                {'asset': 'ETH', 'amount': Decimal('450.00'), 'fiat': Decimal('225.00')},
                {'asset': 'BTC', 'amount': Decimal('1.66666667'), 'fiat': Decimal('22.50')},
                {'asset': 'SOL', 'amount': Decimal('16.66666670'), 'fiat': Decimal('22.50')},
                {'asset': 'BTC', 'amount': Decimal('1.66666667'), 'fiat': Decimal('22.50')},
                {'asset': 'ETH', 'amount': Decimal('450.00'), 'fiat': Decimal('225.00')},
                {'asset': 'BTC', 'amount': Decimal('1.66666667'), 'fiat': Decimal('22.50')},
                {'asset': 'SOL', 'amount': Decimal('33.33333334'), 'fiat': Decimal('22.50')},
                {'asset': 'BTC', 'amount': Decimal('1.66666667'), 'fiat': Decimal('22.50')},
            ]
            
            for i, tx_data in enumerate(transactions_data):
                asset = tx_data['asset']
                amount = tx_data['amount']
                fiat = tx_data['fiat']
                
                price_at_time = PRICES_2012.get(asset, Decimal('1.00'))
                
                # Backdate to December 2012
                created_date = datetime.datetime(2012, 12, 1) + timedelta(days=i)
                created_date = created_date.replace(hour=0, minute=0, second=0)
                created_at = timezone.make_aware(created_date)
                
                tx = Transaction.objects.create(
                    user=user,
                    transaction_type='receive',
                    asset=asset,
                    amount=amount,
                    fee=Decimal('0E-8'),
                    status='completed',
                    txid=f"tx_{tx_counter:08d}_{i:03d}",
                    to_address=None,
                    from_address=None,
                    counterparty=None,
                    destination_asset=None,
                    destination_amount=None,
                    fiat_amount=fiat,
                    price_at_time=price_at_time,
                    memo=f"{asset} receive - ${fiat:.2f}",
                    metadata={
                        'backfilled': True,
                        'source': 'management_command_simple',
                        'original_usd': str(fiat),
                    },
                    created_at=created_at,
                    completed_at=created_at
                )
                self.stdout.write("  [OK] Transaction {i}: {asset} {amount} (${fiat:.2f})".format(i=i+1, asset=asset, amount=amount, fiat=fiat))
            
            # 3. Create WalletAssets (all set to 0 quantity)
            assets_to_create = [
                {'ticker': 'BTC', 'name': 'Bitcoin'},
                {'ticker': 'ETH', 'name': 'Ethereum'},
                {'ticker': 'USDT', 'name': 'Tether'},
                {'ticker': 'BNB', 'name': 'BNB'},
                {'ticker': 'SOL', 'name': 'Solana'},
                {'ticker': 'LTC', 'name': 'Litecoin'},
                {'ticker': 'XRP', 'name': 'Ripple'},
                {'ticker': 'ADA', 'name': 'Cardano'},
                {'ticker': 'DOT', 'name': 'Polkadot'},
                {'ticker': 'DOGE', 'name': 'Dogecoin'},
                {'ticker': 'LINK', 'name': 'Chainlink'},
            ]
            
            self.stdout.write(f"\nCreating wallet assets (all set to 0 quantity)...")
            for asset_data in assets_to_create:
                wallet_asset = WalletAsset.objects.get_or_create(
                    user=user,
                    ticker=asset_data['ticker'],
                    defaults={
                        'name': asset_data['name'],
                        'quantity': Decimal('0'),
                        'available_quantity': Decimal('0'),
                        'locked_quantity': Decimal('0'),
                    }
                )[0]
                wallet_asset.quantity = Decimal('0')
                wallet_asset.available_quantity = Decimal('0')
                wallet_asset.locked_quantity = Decimal('0')
                wallet_asset.save()
                self.stdout.write("  [OK] {ticker} set to 0".format(ticker=asset_data['ticker']))
            
            # 4. Update user role
            user.role = 'user'
            user.save()
            
            self.stdout.write("\n[OK] Matt Frewer account created successfully!")
            self.stdout.write("  Email: {email}".format(email=user.email))
            self.stdout.write("  Name: {first} {last}".format(first=user.first_name, last=user.last_name))
            self.stdout.write("  Phone: {phone}".format(phone=user.phone))
            self.stdout.write("  Public ID: {pid}".format(pid=user.public_id))
            self.stdout.write("  KYC Status: {kyc}".format(kyc=user.kyc_status))
            self.stdout.write("  Transaction Count: {count}".format(
                count=Transaction.objects.filter(user=user).count()
            ))
            self.stdout.write("  Wallet Assets: {count}".format(
                count=WalletAsset.objects.filter(user=user).count()
            ))
            
            return
