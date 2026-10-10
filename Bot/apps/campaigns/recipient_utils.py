from apps.campaigns.models import CampaignLead


DELIVERED_LEAD_STATUSES = {'sent', 'opened', 'clicked'}
DELIVERED_EMAIL_STATUSES = {'sent', 'delivered', 'opened', 'clicked'}
RETRYABLE_LEAD_STATUSES = {'pending', 'queued', 'failed'}


def canonical_campaign_email(email):
    normalized = (email or '').strip().lower()
    local_part, separator, domain = normalized.rpartition('@')
    if separator and local_part and domain:
        base_local_part = local_part.split('+', 1)[0]
        if base_local_part:
            return f'{base_local_part}@{domain}'
    return normalized


def campaign_recipient_count(campaign):
    seen = set()
    count = 0
    for lead in CampaignLead.objects.filter(campaign=campaign):
        if lead.source == 'crypgo_user':
            key = ('crypgo_user', canonical_campaign_email(lead.recipient_email))
        else:
            key = (lead.source, lead.pk)
        if key not in seen:
            seen.add(key)
            count += 1
    return count


def reconcile_campaign_recipients(campaign, *, apply=False):
    """Group plus-tag aliases and preserve a single delivered record per inbox."""
    from apps.email_engine.models import EmailLog

    leads = list(
        CampaignLead.objects.filter(campaign=campaign, source='crypgo_user').order_by('id')
    )
    grouped = {}
    for lead in leads:
        key = canonical_campaign_email(lead.recipient_email)
        grouped.setdefault(key or f'lead:{lead.pk}', []).append(lead)

    delivered_emails = {
        canonical_campaign_email(email)
        for email in EmailLog.objects.filter(
            campaign=campaign,
            status__in=DELIVERED_EMAIL_STATUSES,
        ).values_list('recipient_email', flat=True)
    }
    delivered_by_email = {}
    for log in EmailLog.objects.filter(
        campaign=campaign,
        status__in=DELIVERED_EMAIL_STATUSES,
    ).order_by('sent_at', 'id'):
        delivered_by_email.setdefault(canonical_campaign_email(log.recipient_email), log)

    stats = {
        'inboxes': len(grouped),
        'delivered_inboxes': 0,
        'pending_inboxes': 0,
        'duplicates': 0,
        'updated': 0,
        'groups': [],
    }

    for inbox, inbox_leads in grouped.items():
        delivered_leads = [lead for lead in inbox_leads if lead.status in DELIVERED_LEAD_STATUSES]
        inbox_delivered = inbox in delivered_emails or bool(delivered_leads)
        delivery_log = None
        if inbox_delivered:
            stats['delivered_inboxes'] += 1
            retryable = [lead for lead in inbox_leads if lead.status in RETRYABLE_LEAD_STATUSES]
            candidates = delivered_leads or retryable or inbox_leads
            keeper = min(
                candidates,
                key=lambda lead: (
                    (lead.recipient_email or '').strip().lower() != inbox,
                    lead.pk,
                ),
            )
            delivery_log = delivered_by_email.get(inbox)
        else:
            retryable = [lead for lead in inbox_leads if lead.status in RETRYABLE_LEAD_STATUSES]
            if not retryable:
                stats['groups'].append({
                    'inbox': inbox,
                    'accounts': [
                        {
                            'id': lead.external_user_id,
                            'email': lead.recipient_email,
                            'status': lead.status,
                        }
                        for lead in inbox_leads
                    ],
                    'delivered': False,
                    'terminal': True,
                    'send_lead_id': None,
                })
                continue
            stats['pending_inboxes'] += 1
            keeper = min(
                retryable,
                key=lambda lead: (
                    (lead.recipient_email or '').strip().lower() != inbox,
                    lead.pk,
                ),
            )

        if apply:
            original_status = keeper.status
            original_sent_at = keeper.sent_at
            original_error_message = keeper.error_message
            if inbox_delivered and keeper.status in RETRYABLE_LEAD_STATUSES:
                keeper.status = 'sent'
                keeper.sent_at = delivery_log.sent_at if delivery_log else keeper.sent_at
                keeper.error_message = ''
            existing_account_emails = (
                keeper.recipient_account_emails
                if isinstance(keeper.recipient_account_emails, list)
                else []
            )
            account_emails = list(dict.fromkeys(
                email
                for email in [
                    *existing_account_emails,
                    *(lead.recipient_email for lead in inbox_leads),
                ]
                if isinstance(email, str) and email.strip()
            ))
            update_fields = []
            has_authoritative_group = bool(keeper.recipient_account_emails) or len(account_emails) > 1
            if has_authoritative_group and account_emails != existing_account_emails:
                keeper.recipient_account_emails = account_emails
                update_fields.append('recipient_account_emails')
            for field, original_value in (
                ('status', original_status),
                ('sent_at', original_sent_at),
                ('error_message', original_error_message),
            ):
                if getattr(keeper, field) != original_value:
                    update_fields.append(field)
            if update_fields:
                update_fields.append('updated_at')
                keeper.save(update_fields=update_fields)
                stats['updated'] += 1

        for lead in inbox_leads:
            if lead.pk == keeper.pk or lead.status not in RETRYABLE_LEAD_STATUSES:
                continue
            stats['duplicates'] += 1
            if apply:
                lead.status = 'duplicate'
                lead.error_message = (
                    f'Grouped with campaign recipient {keeper.recipient_email or keeper.pk} '
                    f'for inbox {inbox}.'
                )
                lead.save(update_fields=['status', 'error_message', 'updated_at'])
                stats['updated'] += 1

        stats['groups'].append({
            'inbox': inbox,
            'accounts': [
                {
                    'id': lead.external_user_id,
                    'email': lead.recipient_email,
                    'status': lead.status,
                }
                for lead in inbox_leads
            ],
            'delivered': inbox_delivered,
            'terminal': False,
            'send_lead_id': keeper.pk if not inbox_delivered else None,
        })

    return stats
