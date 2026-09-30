from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.campaigns.models import Campaign, CampaignLead
from apps.email_engine.models import EmailLog
from apps.leads.models import BlacklistedLead


class Command(BaseCommand):
    help = (
        'Audit campaign recipient logs and optionally requeue explicitly named '
        'unsent recipients. Dry-run unless --apply is provided.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--campaign-id', type=int, required=True)
        parser.add_argument(
            '--email',
            action='append',
            required=True,
            help='Recipient email to audit; pass once per address.',
        )
        parser.add_argument(
            '--error-contains',
            required=True,
            help='Required incident signature that must appear in the recipient error message.',
        )
        parser.add_argument(
            '--since',
            help='Timezone-aware ISO-8601 incident start time for identifying blacklist entries.',
        )
        parser.add_argument('--apply', action='store_true', help='Apply eligible recipient resets.')
        parser.add_argument(
            '--clear-blacklist',
            action='store_true',
            help='Also delete matching auto-blacklist entries created on or after --since.',
        )

    def handle(self, *args, **options):
        campaign_id = options['campaign_id']
        emails = list(dict.fromkeys(email.strip().lower() for email in options['email'] if email.strip()))
        error_signature = options['error_contains'].strip()
        since_value = options.get('since')
        apply_changes = options['apply']
        clear_blacklist = options['clear_blacklist']

        if not emails:
            raise CommandError('Provide at least one non-empty --email.')
        if not error_signature:
            raise CommandError('--error-contains cannot be empty.')

        since = None
        if since_value:
            since = parse_datetime(since_value)
            if since is None or timezone.is_naive(since):
                raise CommandError('--since must be a timezone-aware ISO-8601 datetime.')
        if clear_blacklist and since is None:
            raise CommandError('--clear-blacklist requires --since to limit deletion to this incident.')

        campaign = Campaign.objects.filter(pk=campaign_id).first()
        if campaign is None:
            raise CommandError(f'Campaign {campaign_id} does not exist.')

        self.stdout.write(f'Campaign {campaign.pk}: {campaign.name}')
        self.stdout.write('Mode: APPLY' if apply_changes else 'Mode: DRY RUN (no database changes)')
        confirmed_sent = list(
            EmailLog.objects.filter(
                campaign=campaign,
                status__in=['sent', 'delivered', 'opened', 'clicked'],
            ).values_list('recipient_email', flat=True).distinct().order_by('recipient_email')
        )
        self.stdout.write('Confirmed sent addresses: ' + (', '.join(confirmed_sent) or 'none'))

        reset_emails = []
        for email in emails:
            logs = EmailLog.objects.filter(campaign=campaign, recipient_email__iexact=email)
            log_count = logs.count()
            lead_query = CampaignLead.objects.filter(
                campaign=campaign,
                recipient_email__iexact=email,
                status__in=['failed', 'bounced'],
                error_message__icontains=error_signature,
            )
            eligible_leads = list(lead_query.only('id', 'status', 'error_message'))
            if log_count:
                statuses = ', '.join(sorted(set(logs.values_list('status', flat=True))))
                self.stdout.write(
                    f'SKIP {email}: {log_count} campaign EmailLog record(s) [{statuses}]; do not requeue.'
                )
            elif eligible_leads:
                ids = [lead.pk for lead in eligible_leads]
                reset_emails.append(email)
                self.stdout.write(
                    f'RESET CANDIDATE {email}: CampaignLead IDs {ids}; '
                    'zero EmailLog records for this campaign.'
                )
            else:
                self.stdout.write(
                    f'NO ACTION {email}: no failed/bounced recipient row matching '
                    f'{error_signature!r}.'
                )

        blacklist_candidates = []
        if since is not None:
            for email in emails:
                matches = BlacklistedLead.objects.filter(
                    email__iexact=email,
                    created_at__gte=since,
                    reason__icontains='auto-blacklisted',
                )
                for entry in matches:
                    blacklist_candidates.append((entry.pk, email))
                    self.stdout.write(
                        f'BLACKLIST CANDIDATE {entry.email}: created {entry.created_at.isoformat()}, '
                        f'reason={entry.reason}'
                    )

        if not apply_changes:
            self.stdout.write('Dry run complete; rerun with --apply after reviewing candidates.')
            return

        with transaction.atomic():
            reset_count = 0
            for email in reset_emails:
                has_campaign_log = EmailLog.objects.filter(
                    campaign=campaign,
                    recipient_email__iexact=email,
                ).exists()
                if has_campaign_log:
                    self.stdout.write(f'SKIP {email}: campaign EmailLog appeared during audit.')
                    continue
                reset_count += CampaignLead.objects.filter(
                    campaign=campaign,
                    recipient_email__iexact=email,
                    status__in=['failed', 'bounced'],
                    error_message__icontains=error_signature,
                ).update(status='pending', error_message='', retry_count=0, updated_at=timezone.now())

            deleted_blacklists = 0
            if clear_blacklist:
                for blacklist_id, email in blacklist_candidates:
                    deleted, _ = BlacklistedLead.objects.filter(
                        pk=blacklist_id,
                        email__iexact=email,
                        created_at__gte=since,
                        reason__icontains='auto-blacklisted',
                    ).delete()
                    deleted_blacklists += deleted

        self.stdout.write(self.style.SUCCESS(
            f'Reset {reset_count} recipient row(s); removed {deleted_blacklists} '
            'incident-matched blacklist row(s). Bounce history was preserved.'
        ))