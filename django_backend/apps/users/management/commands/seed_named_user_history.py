from datetime import datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.users.models import CustomUser, Transaction, WalletAsset


TARGET_EMAILS = (
    'sirmattfrewer@gmail.com',
    'austin433433@gmail.com',
    'team.drharrignton@gmail.com',
)
TARGET_USERS = {
    'sirmattfrewer@gmail.com': {
        'username': 'sirmattfrewer',
        'first_name': 'Matt',
        'last_name': 'Frewer',
        'date_of_birth': datetime(1958, 1, 4).date(),
        'phone': '+12352145862',
        'country': 'United States',
    },
    'austin433433@gmail.com': {
        'username': 'austin433433',
        'first_name': 'Austin',
        'last_name': 'Miller',
        'date_of_birth': datetime(1961, 5, 15).date(),
        'phone': '+12352145862',
        'country': 'United States',
    },
    'team.drharrignton@gmail.com': {
        'username': 'matthewharrington',
        'first_name': 'Matthew',
        'last_name': 'Harrington',
        'date_of_birth': datetime(1961, 5, 15).date(),
        'phone': '+12352145862',
        'country': 'United States',
    },
}
HISTORY_SOURCE = 'named_user_history_2012'
ACCOUNT_PASSWORD = 'Password123!'
HISTORICAL_BTC_TOTAL = Decimal('105.00000000')
HISTORICAL_BTC_PER_TRANSACTION = Decimal('8.75000000')
HISTORICAL_BTC_PRICE = Decimal('13.50')
TOTAL_TRANSACTIONS = 150
HISTORICAL_TRANSACTION_COUNT = 12
EXTRA_TRANSACTION_COUNT = TOTAL_TRANSACTIONS - HISTORICAL_TRANSACTION_COUNT
SWAP_COUNT = 24
ASSETS = ('BTC', 'ETH', 'USDT', 'BNB', 'SOL', 'LTC', 'XRP', 'ADA', 'DOT', 'DOGE', 'LINK')


class Command(BaseCommand):
    help = 'Seed 150 deterministic transactions for the three named customer accounts.'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--yes', action='store_true')

    def handle(self, *args, **options):
        users = []
        for email in TARGET_EMAILS:
            profile = TARGET_USERS[email]
            user, created = CustomUser.objects.get_or_create(
                email=email,
                defaults={**profile, 'is_active': True, 'role': 'user'},
            )
            if created:
                user.set_password(ACCOUNT_PASSWORD)
                user.save(update_fields=['password'])
            else:
                changed_fields = []
                for field, value in profile.items():
                    if getattr(user, field) != value:
                        setattr(user, field, value)
                        changed_fields.append(field)
                if changed_fields:
                    user.save(update_fields=changed_fields)
            users.append(user)

        self.stdout.write(f'Target users: {len(users)}')
        self.stdout.write(f'Transactions per user: {TOTAL_TRANSACTIONS}')
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run: no database changes made.'))
            return
        if not options['yes']:
            confirmation = input('Replace this seed history for the three accounts? [y/N] ').strip().lower()
            if confirmation not in {'y', 'yes'}:
                self.stdout.write('Cancelled: no database changes made.')
                return

        with transaction.atomic():
            for user in users:
                self._replace_user_history(user)

        self.stdout.write(self.style.SUCCESS(
            f'Created {len(users) * TOTAL_TRANSACTIONS} transactions across {len(users)} users.'
        ))

    def _replace_user_history(self, user):
        user.set_password(ACCOUNT_PASSWORD)
        user.is_active = True
        user.save(update_fields=['password', 'is_active'])
        Transaction.objects.filter(user=user, metadata__source=HISTORY_SOURCE).delete()
        rows = []

        for index in range(HISTORICAL_TRANSACTION_COUNT):
            created_at = timezone.make_aware(
                datetime(2012, 12, 21) + timedelta(days=index // 2, hours=index % 2)
            )
            rows.append(self._transaction(
                user=user,
                index=index + 1,
                transaction_type='receive',
                asset='BTC',
                amount=HISTORICAL_BTC_PER_TRANSACTION,
                fiat_amount=(HISTORICAL_BTC_PER_TRANSACTION * HISTORICAL_BTC_PRICE).quantize(Decimal('0.01')),
                price=HISTORICAL_BTC_PRICE,
                created_at=created_at,
                memo='Historical BTC receive from December 2012',
            ))

        for extra_index in range(EXTRA_TRANSACTION_COUNT):
            index = HISTORICAL_TRANSACTION_COUNT + extra_index + 1
            transaction_type = 'swap' if extra_index < SWAP_COUNT else ('send' if extra_index % 2 else 'receive')
            asset = ASSETS[extra_index % len(ASSETS)]
            destination_asset = ASSETS[(extra_index + 1) % len(ASSETS)] if transaction_type == 'swap' else None
            fiat_amount = Decimal(125 + (extra_index * 37) % 375).quantize(Decimal('0.01'))
            price = Decimal('1.00') if asset == 'USDT' else Decimal('10.00')
            amount = (fiat_amount / price).quantize(Decimal('0.00000001'))
            created_at = timezone.make_aware(datetime(2023, 1, 1) + timedelta(days=extra_index))
            rows.append(self._transaction(
                user=user,
                index=index,
                transaction_type=transaction_type,
                asset=asset,
                amount=amount,
                fiat_amount=fiat_amount,
                price=price,
                destination_asset=destination_asset,
                destination_amount=amount if destination_asset else None,
                created_at=created_at,
                memo=f'Generated {transaction_type} history',
            ))

        Transaction.objects.bulk_create(rows)
        wallet_asset, _ = WalletAsset.objects.get_or_create(user=user, ticker='BTC', defaults={'name': 'Bitcoin'})
        wallet_asset.quantity = HISTORICAL_BTC_TOTAL
        wallet_asset.available_quantity = HISTORICAL_BTC_TOTAL
        wallet_asset.locked_quantity = Decimal('0')
        wallet_asset.save(update_fields=['quantity', 'available_quantity', 'locked_quantity', 'updated_at'])

    def _transaction(self, *, user, index, transaction_type, asset, amount, fiat_amount, price,
                     created_at, memo, destination_asset=None, destination_amount=None):
        return Transaction(
            user=user,
            transaction_type=transaction_type,
            asset=asset,
            amount=amount,
            fee=Decimal('0'),
            status='completed',
            txid=f'{HISTORY_SOURCE}-{user.pk}-{index:03d}',
            destination_asset=destination_asset,
            destination_amount=destination_amount,
            fiat_amount=fiat_amount,
            price_at_time=price,
            memo=memo,
            metadata={'backfilled': True, 'source': HISTORY_SOURCE},
            created_at=created_at,
            completed_at=created_at,
        )