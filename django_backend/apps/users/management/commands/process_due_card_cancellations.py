import time

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.users.models import CardApplication, CardApplicationAsset, CardIssuer
from apps.users.services import send_card_application_cancellation_email


class Command(BaseCommand):
    help = 'Send cancellation emails and hide card applications pending for 23 hours.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--loop',
            action='store_true',
            help='Keep checking for due cancellations instead of running once.',
        )
        parser.add_argument(
            '--interval',
            type=int,
            default=60,
            help='Seconds between checks when --loop is used (default: 60).',
        )

    def handle(self, *args, **options):
        interval = options['interval']
        if interval < 1:
            raise CommandError('--interval must be at least 1 second.')

        while True:
            self.process_due_applications()
            if not options['loop']:
                return
            time.sleep(interval)

    def process_due_applications(self):
        now = timezone.now()
        application_ids = list(
            CardApplication.objects.filter(
                status=CardApplication.STATUS_ACTIVATION_PENDING,
                cancellation_due_at__lte=now,
            ).order_by('cancellation_due_at').values_list('pk', flat=True)
        )

        for application_id in application_ids:
            with transaction.atomic():
                application = (
                    CardApplication.objects.select_for_update()
                    .select_related('user')
                    .filter(
                        pk=application_id,
                        status=CardApplication.STATUS_ACTIVATION_PENDING,
                        cancellation_due_at__lte=timezone.now(),
                    )
                    .first()
                )
                if application is None:
                    continue

                if application.cancellation_email_sent_at is None:
                    if not send_card_application_cancellation_email(application.user):
                        self.stderr.write(
                            self.style.ERROR(
                                f'Cancellation email failed for application {application_id}; it remains pending for retry.'
                            )
                        )
                        continue
                    application.cancellation_email_sent_at = timezone.now()
                    application.save(update_fields=['cancellation_email_sent_at'])

            with transaction.atomic():
                application = (
                    CardApplication.objects.select_for_update()
                    .filter(
                        pk=application_id,
                        status=CardApplication.STATUS_ACTIVATION_PENDING,
                        cancellation_due_at__lte=timezone.now(),
                        cancellation_email_sent_at__isnull=False,
                    )
                    .first()
                )
                if application is None:
                    continue

                card_number = application.card_number
                user_id = application.user_id
                CardApplicationAsset.objects.filter(application=application).delete()
                application.status = CardApplication.STATUS_CANCELED
                application.cancellation_due_at = None
                application.save(update_fields=[
                    'status',
                    'cancellation_due_at',
                    'updated_at',
                ])
                if card_number is not None:
                    CardIssuer.objects.filter(
                        user_id=user_id,
                        card_issuer_number=card_number,
                    ).delete()
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Canceled and hid card application {application_id} after notifying its owner.'
                    )
                )
