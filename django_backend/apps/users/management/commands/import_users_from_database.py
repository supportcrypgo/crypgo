import json
import sqlite3
from collections import defaultdict
from datetime import datetime
from decimal import Decimal
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.users.models import CustomUser, Transaction, WalletAddress, WalletAsset
from apps.users.signals import ASSET_DEFS
from apps.users.wallet_address import build_wallet_address


EXCLUDED_EMAIL = 'sirmattfrewer@gmail.com'


class Command(BaseCommand):
    help = 'Import users, wallet balances, transactions, and internal-transfer addresses from another Crypgo SQLite database.'

    def add_arguments(self, parser):
        parser.add_argument('source_database', type=Path)
        parser.add_argument('--dry-run', action='store_true')
        parser.add_argument('--yes', action='store_true', help='Apply without confirmation.')

    def handle(self, *args, **options):
        source_path = options['source_database'].resolve()
        if not source_path.is_file():
            raise CommandError(f'Source database not found: {source_path}')

        summary = self.inspect_source(source_path)
        self.stdout.write(
            f"Source: {summary['users']} users, {summary['wallet_assets']} wallet assets, "
            f"{summary['transactions']} transactions, {summary['internal_transfers']} internal transfers."
        )
        self.stdout.write(
            f"Eligible for import: {summary['eligible_users']} users, "
            f"{summary['eligible_transactions']} transactions."
        )
        if options['dry_run']:
            self.stdout.write(self.style.WARNING('Dry run only. No changes were made.'))
            return
        if not options['yes']:
            confirmation = input('Import these records into the current database? Type yes to continue: ').strip().lower()
            if confirmation != 'yes':
                self.stdout.write('Cancelled. No changes were made.')
                return

        result = self.import_database(source_path)
        self.stdout.write(self.style.SUCCESS(
            f"Imported {result['users']} users, {result['wallet_assets']} wallet assets, "
            f"{result['addresses']} wallet addresses, and {result['transactions']} transactions."
        ))

    def inspect_source(self, source_path):
        with sqlite3.connect(source_path) as source:
            source.row_factory = sqlite3.Row
            users = list(source.execute('select id, email from users order by id'))
            excluded_ids = {
                row['id'] for row in users if (row['email'] or '').strip().lower() == EXCLUDED_EMAIL
            }
            eligible_ids = {row['id'] for row in users if row['id'] not in excluded_ids}
            return {
                'users': len(users),
                'eligible_users': len(eligible_ids),
                'wallet_assets': source.execute('select count(*) from wallet_assets').fetchone()[0],
                'transactions': source.execute('select count(*) from users_transaction').fetchone()[0],
                'eligible_transactions': source.execute(
                    'select count(*) from users_transaction where user_id in ({})'.format(
                        ','.join('?' for _ in eligible_ids)
                    ), tuple(eligible_ids)
                ).fetchone()[0] if eligible_ids else 0,
                'internal_transfers': source.execute('select count(*) from internal_transfers').fetchone()[0],
            }

    def import_database(self, source_path):
        with sqlite3.connect(source_path) as source:
            source.row_factory = sqlite3.Row
            source_users = list(source.execute('select * from users order by id'))
            source_user_by_id = {row['id']: row for row in source_users}
            excluded_ids = {
                row['id'] for row in source_users
                if (row['email'] or '').strip().lower() == EXCLUDED_EMAIL
            }
            eligible_users = [row for row in source_users if row['id'] not in excluded_ids]
            target_by_email = {
                user.email.strip().lower(): user
                for user in CustomUser.objects.all()
            }
            source_emails = {
                (row['email'] or '').strip().lower()
                for row in eligible_users
            }
            collisions = sorted(source_emails & set(target_by_email))
            if collisions:
                raise CommandError(
                    'Refusing to overwrite existing target users: ' + ', '.join(collisions)
                )

            user_map = {}
            imported_users = []
            with transaction.atomic():
                for row in eligible_users:
                    email = (row['email'] or '').strip().lower()
                    public_id = row['public_id'] or None
                    if public_id and CustomUser.objects.filter(public_id=public_id).exists():
                        public_id = None
                    user = CustomUser.objects.create(
                        password=row['password'],
                        last_login=self.parse_datetime(row['last_login']),
                        is_superuser=bool(row['is_superuser']),
                        username=row['username'],
                        is_staff=bool(row['is_staff']),
                        email=email,
                        is_active=bool(row['is_active']),
                        date_joined=self.parse_datetime(row['date_joined']),
                        updated_at=self.parse_datetime(row['updated_at']),
                        first_name=row['first_name'] or '',
                        last_name=row['last_name'] or '',
                        phone=row['phone'] or '',
                        country=row['country'] or '',
                        city=row['city'] or '',
                        address=row['address'] or '',
                        avatar_url=row['avatar_url'] or '',
                        role=row['role'] or 'user',
                        email_preferences=self.parse_json(row['email_preferences'], {}),
                        kyc_rejection_reason=row['kyc_rejection_reason'],
                        kyc_reviewed_at=self.parse_datetime(row['kyc_reviewed_at']),
                        kyc_status=row['kyc_status'] or 'none',
                        kyc_submitted_at=self.parse_datetime(row['kyc_submitted_at']),
                        two_fa_backup_codes=self.parse_json(row['two_fa_backup_codes'], []),
                        two_fa_enabled=bool(row['two_fa_enabled']),
                        two_fa_secret=row['two_fa_secret'],
                        public_id=public_id,
                        date_of_birth=self.parse_date(row['date_of_birth']) if 'date_of_birth' in row.keys() else None,
                        transaction_guard_enabled=True,
                        transaction_guard_started_at=timezone.now(),
                        transaction_guard_success_count=2,
                    )
                    user_map[row['id']] = user
                    imported_users.append(user)

                asset_rows = list(source.execute('select * from wallet_assets where user_id in ({})'.format(
                    ','.join('?' for _ in user_map)
                ), tuple(user_map))) if user_map else []
                target_assets = {
                    (user.id, ticker): WalletAsset.objects.get(user_id=user.id, ticker=ticker)
                    for user in imported_users
                    for ticker, _name in ASSET_DEFS
                    if WalletAsset.objects.filter(user_id=user.id, ticker=ticker).exists()
                }
                for row in asset_rows:
                    user = user_map[row['user_id']]
                    asset, _ = WalletAsset.objects.get_or_create(
                        user=user,
                        ticker=row['ticker'],
                        defaults={'name': row['name'] or row['ticker']},
                    )
                    asset.name = row['name'] or row['ticker']
                    asset.quantity = Decimal(str(row['quantity']))
                    asset.available_quantity = Decimal(str(row['available_quantity']))
                    asset.locked_quantity = Decimal(str(row['locked_quantity']))
                    asset.created_at = self.parse_datetime(row['created_at']) or asset.created_at
                    asset.updated_at = self.parse_datetime(row['updated_at']) or asset.updated_at
                    asset.save()

                for user in imported_users:
                    for ticker, _name in ASSET_DEFS:
                        WalletAddress.objects.get_or_create(
                            user=user,
                            ticker=ticker,
                            network='mainnet',
                            defaults={
                                'address': build_wallet_address(user.id, ticker),
                                'is_active': True,
                            },
                        )

                tx_rows = list(source.execute('select * from users_transaction where user_id in ({})'.format(
                    ','.join('?' for _ in user_map)
                ), tuple(user_map))) if user_map else []
                existing_txids = set(
                    Transaction.objects.filter(txid__isnull=False).values_list('txid', flat=True)
                )
                tx_map = {}
                for row in tx_rows:
                    txid = row['txid']
                    if txid and txid in existing_txids:
                        raise CommandError(f'Transaction ID already exists in target: {txid}')
                    counterparty_id = self.map_related_user(
                        row['counterparty_id'], source_user_by_id, user_map, target_by_email
                    )
                    tx = Transaction.objects.create(
                        user=user_map[row['user_id']],
                        transaction_type=row['transaction_type'],
                        asset=row['asset'],
                        amount=Decimal(str(row['amount'])),
                        fee=Decimal(str(row['fee'])),
                        status=row['status'],
                        txid=txid or None,
                        to_address=row['to_address'],
                        from_address=row['from_address'],
                        counterparty_id=counterparty_id,
                        destination_asset=row['destination_asset'],
                        destination_amount=self.decimal_or_none(row['destination_amount']),
                        fiat_amount=self.decimal_or_none(row['fiat_amount']),
                        price_at_time=self.decimal_or_none(row['price_at_time']),
                        memo=row['memo'],
                        metadata=self.parse_json(row['metadata'], {}),
                        created_at=self.parse_datetime(row['created_at']),
                        updated_at=self.parse_datetime(row['updated_at']),
                        completed_at=self.parse_datetime(row['completed_at']),
                    )
                    tx_map[row['id']] = tx
                    existing_txids.add(tx.txid)

                source_internal_count = source.execute('select count(*) from internal_transfers').fetchone()[0]
                if source_internal_count:
                    raise CommandError(
                        'Source contains internal transfers; import stopped before commit because '
                        'their transaction relationships need an explicit remapping pass.'
                    )

            return {
                'users': len(imported_users),
                'wallet_assets': len(asset_rows),
                'addresses': len(imported_users) * len(ASSET_DEFS),
                'transactions': len(tx_rows),
            }

    @staticmethod
    def map_related_user(source_id, source_user_by_id, user_map, target_by_email):
        if not source_id:
            return None
        if source_id in user_map:
            return user_map[source_id].id
        source_user = source_user_by_id.get(source_id)
        if not source_user:
            return None
        email = (source_user['email'] or '').strip().lower()
        target_user = target_by_email.get(email)
        return target_user.id if target_user else None

    @staticmethod
    def parse_datetime(value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        return datetime.fromisoformat(str(value).replace('Z', '+00:00'))

    @staticmethod
    def parse_date(value):
        return str(value)[:10] if value else None

    @staticmethod
    def parse_json(value, default):
        if not value:
            return default
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return default

    @staticmethod
    def decimal_or_none(value):
        return Decimal(str(value)) if value is not None else None
