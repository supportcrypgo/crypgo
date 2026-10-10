import getpass
import hashlib
import os
import re
import sys
from pathlib import Path

from django.conf import settings
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email
from django.db import transaction
from django.utils.text import slugify

from apps.users.email_identity import normalize_shared_inbox
from apps.users.models import CustomUser, WalletAddress, WalletAsset
from apps.users.signals import ASSET_DEFS
from apps.users.wallet_address import build_wallet_address


EMAIL_PATTERN = re.compile(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', re.IGNORECASE)


def parse_contact_name(prefix: str) -> tuple[str, str]:
    name = re.sub(r'^[\s\d.,;|:()<>\-]+|[\s,;|:()<>\-]+$', '', prefix)
    name = re.sub(r'\s+', ' ', name)
    if ',' in name:
        first_name, last_name = (part.strip() for part in name.split(',', 1))
        return first_name[:150], last_name[:150]

    parts = name.split()
    if not parts:
        return '', ''
    return parts[0][:150], ' '.join(parts[1:])[:150]


def username_for_email(email: str) -> str:
    email_slug = slugify(email)[:120] or 'contact'
    suffix = hashlib.sha256(email.encode('utf-8')).hexdigest()[:16]
    return f'{email_slug}-{suffix}'


class Command(BaseCommand):
    help = 'Preview or create base/+1 user accounts for contacts in people.txt.'

    def add_arguments(self, parser):
        parser.add_argument(
            'source',
            nargs='?',
            type=Path,
            default=Path(settings.BASE_DIR).parent / 'people.txt',
        )
        parser.add_argument(
            '--apply',
            action='store_true',
            help='Create planned accounts after explicit confirmation.',
        )
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip the interactive count confirmation; requires the password environment variable.',
        )

    def handle(self, *args, **options):
        source = options['source'].resolve()
        if not source.is_file():
            raise CommandError(f'Contact file not found: {source}')

        plan, stats = self.build_plan(source)
        self.write_summary(source, plan, stats)
        if not options['apply']:
            self.stdout.write(self.style.WARNING('Dry run only. No database changes were made.'))
            return
        if not plan:
            self.stdout.write('Nothing to create.')
            return

        if options['yes']:
            password = os.environ.get('CRYPGO_IMPORT_INITIAL_PASSWORD', '')
            if not password:
                raise CommandError(
                    '--yes requires CRYPGO_IMPORT_INITIAL_PASSWORD to be set.'
                )
        else:
            expected_confirmation = f'CREATE {sum(len(pair) for pair in plan.values())}'
            confirmation = input(
                f'Type "{expected_confirmation}" to create these accounts: '
            ).strip()
            if confirmation != expected_confirmation:
                self.stdout.write('Cancelled. No database changes were made.')
                return

            password = self.read_initial_password('Initial password for all new accounts: ')
            password_confirmation = self.read_initial_password('Confirm initial password: ')
            if not password or password != password_confirmation:
                raise CommandError('The password was empty or the confirmation did not match.')

        created_count = self.create_accounts(source, plan, password)
        self.stdout.write(self.style.SUCCESS(f'Created {created_count} new accounts.'))

    def read_initial_password(self, prompt: str) -> str:
        if sys.stdin.isatty():
            return getpass.getpass(prompt)
        self.stderr.write(f'{prompt} (read without echo from stdin)')
        return sys.stdin.readline().rstrip('\r\n')

    def build_plan(self, source: Path):
        stats = {
            'rows': 0,
            'single_email_rows': 0,
            'multiple_email_rows': 0,
            'additional_addresses_ignored': 0,
            'no_email_rows': 0,
            'invalid_email_rows': 0,
            'unnamed_rows': 0,
            'duplicate_addresses': 0,
            'contacts': 0,
            'existing_pairs': 0,
            'partial_pairs': 0,
        }
        contacts = {}
        for line in source.read_text(encoding='utf-8-sig', errors='replace').splitlines():
            stats['rows'] += 1
            matches = list(EMAIL_PATTERN.finditer(line))
            if not matches:
                stats['no_email_rows'] += 1
                continue
            if len(matches) > 1:
                stats['multiple_email_rows'] += 1
                stats['additional_addresses_ignored'] += len(matches) - 1
            else:
                stats['single_email_rows'] += 1
            email_match = matches[0]
            email = email_match.group(0).strip().lower()
            try:
                validate_email(email)
            except ValidationError:
                stats['invalid_email_rows'] += 1
                continue

            base_email = normalize_shared_inbox(email)
            if not base_email:
                stats['invalid_email_rows'] += 1
                continue
            first_name, last_name = parse_contact_name(line[:email_match.start()])
            if not first_name and not last_name:
                stats['unnamed_rows'] += 1
                continue
            if base_email in contacts:
                stats['duplicate_addresses'] += 1
                existing_name = contacts[base_email]
                if not existing_name[0] and not existing_name[1]:
                    contacts[base_email] = (first_name, last_name)
                continue
            contacts[base_email] = (first_name, last_name)

        stats['contacts'] = len(contacts)
        existing_emails = {
            email.strip().lower()
            for email in CustomUser.objects.values_list('email', flat=True)
            if email
        }
        plan = {}
        for base_email, name in contacts.items():
            local_part, _, domain = base_email.rpartition('@')
            alias_email = f'{local_part}+1@{domain}'
            has_base = base_email in existing_emails
            has_alias = alias_email in existing_emails
            if has_base and has_alias:
                stats['existing_pairs'] += 1
                continue
            if has_base or has_alias:
                stats['partial_pairs'] += 1
                continue
            plan[base_email] = (name, alias_email)
        return plan, stats

    def write_summary(self, source: Path, plan: dict, stats: dict) -> None:
        self.stdout.write(f'Source file: {source}')
        self.stdout.write(
            f"Rows: {stats['rows']}; one-email rows: {stats['single_email_rows']}; "
            f"multiple-email rows: {stats['multiple_email_rows']} "
            f"(first address used; {stats['additional_addresses_ignored']} additional addresses ignored); "
            f"no-email rows skipped: {stats['no_email_rows']}."
        )
        self.stdout.write(
            f"Invalid-email rows skipped: {stats['invalid_email_rows']}; "
            f"unnamed rows skipped: {stats['unnamed_rows']}; "
            f"repeated addresses ignored: {stats['duplicate_addresses']}."
        )
        self.stdout.write(
            f"Unique contacts: {stats['contacts']}; already-complete pairs: "
            f"{stats['existing_pairs']}; partial pairs skipped for review: "
            f"{stats['partial_pairs']}."
        )
        self.stdout.write(
            f"Planned new pairs: {len(plan)}; planned new accounts: "
            f"{sum(len(pair) for pair in plan.values())}."
        )

    def create_accounts(self, source: Path, plan: dict, password: str) -> int:
        with transaction.atomic():
            current_plan, _ = self.build_plan(source)
            if current_plan != plan:
                raise CommandError(
                    'The roster or database changed after preview. No accounts were created; rerun the command.'
                )

            users_to_create = []
            for base_email, ((first_name, last_name), alias_email) in plan.items():
                for email in (base_email, alias_email):
                    if CustomUser.objects.filter(email__iexact=email).exists():
                        raise CommandError(
                            'An account appeared after preview. The transaction was cancelled; rerun the command.'
                        )
                    users_to_create.append(CustomUser(
                        username=username_for_email(email),
                        email=email,
                        password=make_password(password),
                        first_name=first_name,
                        last_name=last_name,
                        country='United States',
                        is_active=True,
                        role='user',
                    ))

            self.stdout.write(f'Prepared secure password hashes for {len(users_to_create)} new accounts.')
            self.stdout.flush()
            created_count = 0
            batch_size = 250
            for start in range(0, len(users_to_create), batch_size):
                user_batch = users_to_create[start:start + batch_size]
                CustomUser.objects.bulk_create(user_batch, batch_size=batch_size)
                wallet_assets = []
                wallet_addresses = []
                for user in user_batch:
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
                WalletAsset.objects.bulk_create(wallet_assets, batch_size=500)
                WalletAddress.objects.bulk_create(wallet_addresses, batch_size=500)
                created_count += len(user_batch)
                self.stdout.write(f'Created {created_count} of {len(users_to_create)} accounts...')
                self.stdout.flush()
            return len(users_to_create)
