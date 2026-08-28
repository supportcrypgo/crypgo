import logging
import random
from django.utils import timezone

logger = logging.getLogger(__name__)


class ABTesting:
    """
    A/B testing support for campaigns.
    Allows splitting a campaign into variants A and B to compare performance.
    """

    def __init__(self, split_ratio=50):
        """
        Initialize A/B test.
        split_ratio: Percentage of leads that get variant B (default 50% = 50/50 split)
        """
        self.split_ratio = split_ratio

    def select_variant(self, campaign, lead, template_a, template_b=None):
        """
        Select which template variant a lead receives.
        Returns: (variant_name, template)
        """
        if template_b is None:
            return 'A', template_a

        # Use lead ID for deterministic split
        lead_id = lead.pk or hash(lead.email)
        variant = 'B' if (lead_id % 100) < self.split_ratio else 'A'

        if variant == 'A':
            return 'A', template_a
        else:
            return 'B', template_b

    def get_split_stats(self, campaign):
        """
        Get comparison statistics for A/B test results.
        """
        from apps.email_engine.models import EmailLog

        # Get logs for variant A
        logs_a = EmailLog.objects.filter(
            campaign=campaign,
            variant='A',
        )
        # Get logs for variant B
        logs_b = EmailLog.objects.filter(
            campaign=campaign,
            variant='B',
        )

        total_a = logs_a.count()
        total_b = logs_b.count()
        sent_a = logs_a.filter(status='sent').count()
        sent_b = logs_b.filter(status='sent').count()
        opened_a = logs_a.filter(opened_at__isnull=False).count()
        opened_b = logs_b.filter(opened_at__isnull=False).count()
        clicked_a = logs_a.filter(clicked_at__isnull=False).count()
        clicked_b = logs_b.filter(clicked_at__isnull=False).count()
        bounced_a = logs_a.filter(status='bounced').count()
        bounced_b = logs_b.filter(status='bounced').count()

        return {
            'variant_a': {
                'total': total_a,
                'sent': sent_a,
                'opened': opened_a,
                'clicked': clicked_a,
                'bounced': bounced_a,
                'open_rate': (opened_a / sent_a * 100) if sent_a > 0 else 0,
                'click_rate': (clicked_a / sent_a * 100) if sent_a > 0 else 0,
                'bounce_rate': (bounced_a / sent_a * 100) if sent_a > 0 else 0,
            },
            'variant_b': {
                'total': total_b,
                'sent': sent_b,
                'opened': opened_b,
                'clicked': clicked_b,
                'bounced': bounced_b,
                'open_rate': (opened_b / sent_b * 100) if sent_b > 0 else 0,
                'click_rate': (clicked_b / sent_b * 100) if sent_b > 0 else 0,
                'bounce_rate': (bounced_b / sent_b * 100) if sent_b > 0 else 0,
            },
            'winner': self._determine_winner(
                sent_a, opened_a, clicked_a,
                sent_b, opened_b, clicked_b,
            ),
        }

    def get_variant_winner(self, stats):
        """Get the winning variant based on stats"""
        return stats.get('winner', 'A')

    def _determine_winner(self, sent_a, opened_a, clicked_a,
                          sent_b, opened_b, clicked_b):
        """
        Determine which variant is performing better.
        Uses open rate as primary metric, click rate as tiebreaker.
        """
        open_rate_a = (opened_a / sent_a * 100) if sent_a > 0 else 0
        open_rate_b = (opened_b / sent_b * 100) if sent_b > 0 else 0

        if open_rate_a > open_rate_b:
            winner = 'A'
        elif open_rate_b > open_rate_a:
            winner = 'B'
        else:
            # Tiebreaker: click rate
            click_rate_a = (clicked_a / sent_a * 100) if sent_a > 0 else 0
            click_rate_b = (clicked_b / sent_b * 100) if sent_b > 0 else 0
            if click_rate_a >= click_rate_b:
                winner = 'A'
            else:
                winner = 'B'

        return winner