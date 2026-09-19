from datetime import datetime, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.users.models import CustomUser, Transaction, WalletAsset


BTC_TOTAL = Decimal('105.00000000')
BTC_PER_TRANSACTION = Decimal('8.75000000')
HISTORICAL_BTC_PRICE = Decimal('49500.00')
BACKFILL_SOURCE = 'bulk_btc_history_2021'
OLD_GENERATED_SOURCES = {
    'management_command_simple',
    'bulk_btc_history_2021',
}

TRANSACTION_DATES = [
    datetime(2021, 12, 21),
    datetime(2021, 12, 21),
    datetime(2021, 12, 22),
    datetime(2021, 12, 22),
    datetime(2021, 12, 23),
    datetime(2021, 12, 23),
    datetime(2021, 12, 24),
    datetime(2021, 12, 24),
    datetime(2021, 12, 25),
    datetime(2021, 12, 26),
    datetime(2021, 12, 27),
    datetime(2021, 12, 27),
]


class Command(BaseCommand):
    help = (
        'Replace marked generated history for active customer accounts with '
        '12 BTC receive transactions totaling 105 BTC.'
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Report the planned changes without modifying the database.',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Apply changes without an interactive confirmation prompt.',
        )

    def handle(self, *args, **options):
        if sum(1 for date in TRANSACTION_DATES if date.year == 2021) != 12:
            raise CommandError('The backfill must define exactly 12 transaction dates.')

        users = CustomUser.objects.filter(
            is_active=True,
            role__iexact='user',
            is_staff=False,
            is_superuser=False,
        ).order_by('id')
        user_count = users.count()
        generated_transactions = Transaction.objects.filter(
            user__in=users,
            metadata__backfilled=True,
        )
        generated_transactions = generated_transactions.filter(
            metadata__source__in=OLD_GENERATED_SOURCES,
        )
        old_transaction_count = generated_transactions.count()

        self.stdout.write(f'Eligible users: {user_count}')
        self.stdout.write(f'Marked generated transactions to replace: {old_transaction_count}')
        self.stdout.write(
            f'New transactions per user: 12 x {BTC_PER_TRANSACTION} BTC '
            f'= {BTC_TOTAL} BTC'
        )

        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run: no database changes made.'))
            return

        if not options['yes']:
            confirmation = input('Apply this backfill to the eligible users? [y/N] ').strip().lower()
            if confirmation not in {'y', 'yes'}:
                self.stdout.write('Cancelled: no database changes made.')
                return

        with transaction.atomic():
            for user in users.iterator():
                self._replace_user_history(user)

        self.stdout.write(
            self.style.SUCCESS(
                f'Completed BTC backfill for {user_count} users '
                f'({user_count * 12} transactions).'
            )
        )

    def _replace_user_history(self, user: CustomUser) -> None:
        old_transaction_ids = list(Transaction.objects.filter(
            user=user,
            metadata__backfilled=True,
            metadata__source__in=OLD_GENERATED_SOURCES,
        ).values_list('id', flat=True))
        for start in range(0, len(old_transaction_ids), 50):
            Transaction.objects.filter(
                id__in=old_transaction_ids[start:start + 50],
            ).delete()

        created_transactions = []
        for index, naive_date in enumerate(TRANSACTION_DATES, start=1):
            created_at = timezone.make_aware(naive_date + timedelta(hours=index))
            created_transactions.append(
                Transaction(
                    user=user,
                    transaction_type='receive',
                    asset='BTC',
                    amount=BTC_PER_TRANSACTION,
                    fee=Decimal('0'),
                    status='completed',
                    txid=f'btc-history-{user.pk}-{index:02d}',
                    fiat_amount=(BTC_PER_TRANSACTION * HISTORICAL_BTC_PRICE).quantize(Decimal('0.01')),
                    price_at_time=HISTORICAL_BTC_PRICE,
                    memo='Historical BTC receive',
                    metadata={
                        'backfilled': True,
                        'source': BACKFILL_SOURCE,
                        'distribution': 'equal',
                        'total_btc': str(BTC_TOTAL),
                    },
                    created_at=created_at,
                    completed_at=created_at,
                )
            )
        Transaction.objects.bulk_create(created_transactions)

        wallet_asset, _ = WalletAsset.objects.get_or_create(
            user=user,
            ticker='BTC',
            defaults={'name': 'Bitcoin'},
        )
        wallet_asset.quantity = BTC_TOTAL
        wallet_asset.available_quantity = BTC_TOTAL
        wallet_asset.locked_quantity = Decimal('0')
        wallet_asset.save(update_fields=[
            'quantity',
            'available_quantity',
            'locked_quantity',
            'updated_at',
        ])
