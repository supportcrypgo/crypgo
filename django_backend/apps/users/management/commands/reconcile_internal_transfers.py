from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from apps.users.models import InternalTransfer, Transaction, WalletAddress, WalletAsset


class Command(BaseCommand):
    help = (
        'Reconcile legacy completed withdrawals sent to a stored Crypgo wallet '
        'address into recipient wallet credits and receive history.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--txid', help='Reconcile one transaction by txid.')
        parser.add_argument('--dry-run', action='store_true', help='Report matches without changing data.')
        parser.add_argument('--yes', action='store_true', help='Apply changes without confirmation.')

    def handle(self, *args, **options):
        withdrawals = Transaction.objects.filter(
            transaction_type='withdrawal',
            status='completed',
            to_address__isnull=False,
        ).exclude(to_address='')
        if options.get('txid'):
            withdrawals = withdrawals.filter(txid=options['txid'])

        matches = []
        for withdrawal in withdrawals.select_related('user').order_by('created_at'):
            address = WalletAddress.objects.filter(
                address__iexact=withdrawal.to_address,
                ticker=withdrawal.asset,
                network='mainnet',
                is_active=True,
            ).select_related('user').first()
            if not address or address.user_id == withdrawal.user_id:
                continue

            already_linked = InternalTransfer.objects.filter(
                sender_transaction=withdrawal,
                recipient=address.user,
            ).exists()
            if already_linked:
                continue

            matches.append((withdrawal, address))

        if not matches:
            self.stdout.write(self.style.SUCCESS('No unreconciled internal withdrawals found.'))
            return

        for withdrawal, address in matches:
            self.stdout.write(
                f'{withdrawal.txid}: {withdrawal.user.email} -> {address.user.email} '
                f'{withdrawal.amount} {withdrawal.asset}'
            )

        if options.get('dry_run'):
            self.stdout.write(self.style.WARNING(f'Dry run: {len(matches)} record(s) would be reconciled.'))
            return

        if not options.get('yes'):
            confirmation = input(f'Reconcile {len(matches)} record(s)? Type yes to continue: ').strip().lower()
            if confirmation != 'yes':
                self.stdout.write('Cancelled.')
                return

        reconciled = 0
        for withdrawal, address in matches:
            with transaction.atomic():
                locked_withdrawal = Transaction.objects.select_for_update().get(pk=withdrawal.pk)
                if InternalTransfer.objects.filter(sender_transaction=locked_withdrawal).exists():
                    continue

                recipient_wallet, _ = WalletAsset.objects.select_for_update().get_or_create(
                    user=address.user,
                    ticker=locked_withdrawal.asset,
                    defaults={
                        'name': locked_withdrawal.asset,
                        'quantity': 0,
                        'available_quantity': 0,
                        'locked_quantity': 0,
                    },
                )
                recipient_wallet.available_quantity += locked_withdrawal.amount
                recipient_wallet.quantity += locked_withdrawal.amount
                recipient_wallet.save(update_fields=['available_quantity', 'quantity'])

                recipient_tx = Transaction.objects.create(
                    user=address.user,
                    transaction_type='transfer_in',
                    asset=locked_withdrawal.asset,
                    amount=locked_withdrawal.amount,
                    status='completed',
                    counterparty=locked_withdrawal.user,
                    from_address=WalletAddress.objects.filter(
                        user=locked_withdrawal.user,
                        ticker=locked_withdrawal.asset,
                        network='mainnet',
                        is_active=True,
                    ).values_list('address', flat=True).first(),
                    memo='Reconciled internal transfer',
                    completed_at=timezone.now(),
                )
                InternalTransfer.objects.create(
                    sender=locked_withdrawal.user,
                    recipient=address.user,
                    asset=locked_withdrawal.asset,
                    amount=locked_withdrawal.amount,
                    status='COMPLETED',
                    sender_transaction=locked_withdrawal,
                    recipient_transaction=recipient_tx,
                    completed_at=timezone.now(),
                )
                reconciled += 1

        self.stdout.write(self.style.SUCCESS(f'Reconciled {reconciled} record(s).'))
