"""Render email templates with lead placeholders"""
import re
import logging

logger = logging.getLogger('email_bot')

from django.template import Template, Context
from django.utils.safestring import mark_safe


class TemplateRenderer:
    """Render email templates with placeholders"""

    # Default placeholder patterns
    PLACEHOLDER_PATTERN = r'\{\{(\w+)\}\}'

    # Known placeholder fields
    KNOWN_PLACEHOLDERS = [
        'first_name', 'last_name', 'email', 'company',
        'job_title', 'phone', 'website', 'address',
        'city', 'state', 'zip_code', 'country',
        'unsubscribe_url', 'tracking_pixel', 'greeting',
        'dashboard_url',
    ]

    @classmethod
    def render(cls, html_content, context_data):
        """Render HTML template with context data

        Args:
            html_content (str): Template HTML with {{placeholder}} tags
            context_data (dict): Dictionary of placeholder values

        Returns:
            str: Rendered HTML with placeholders replaced
        """
        if not html_content:
            return ''

        try:
            # Try Django template engine first (handles filters, blocks, etc)
            template = Template(html_content)
            context = Context(context_data)
            rendered = template.render(context)
            return mark_safe(rendered)
        except Exception as e:
            logger.warning(
                'Django template rendering failed, falling back to simple replace: %s',
                str(e)
            )
            # Fallback: simple placeholder replacement
            return cls._simple_render(html_content, context_data)

    @classmethod
    def _simple_render(cls, content, context_data):
        """Simple placeholder replacement as fallback"""
        result = str(content)
        for key, value in context_data.items():
            if value is None:
                value = ''
            # Replace both {{key}} and {{ key }} (with/without spaces)
            placeholder_variants = [
                f'{{{{{key}}}}}',
                f'{{{{ {key} }}}}',
                f'{{{{ {key}}}}}',
                f'{{{{{key} }}}}',
            ]
            for variant in placeholder_variants:
                result = result.replace(variant, str(value))

        # Remove any remaining unreplaced placeholders
        result = re.sub(r'\{\{.*?\}\}', '', result)

        return result

    @classmethod
    def render_subject(cls, subject, context_data):
        """Render subject line with placeholders"""
        return cls._simple_render(subject, context_data)

    @classmethod
    def get_placeholders(cls, content):
        """Extract all unique placeholders from content"""
        pattern = re.compile(cls.PLACEHOLDER_PATTERN)
        placeholders = re.findall(pattern, content)
        # Return unique, ordered by appearance
        seen = set()
        unique = []
        for p in placeholders:
            if p not in seen:
                seen.add(p)
                unique.append(p)
        return unique

    @classmethod
    def validate_placeholders(cls, content, required_placeholders=None):
        """Validate that all required placeholders exist in template"""
        if required_placeholders is None:
            required_placeholders = ['first_name', 'unsubscribe_url']

        found = cls.get_placeholders(content)
        missing = [p for p in required_placeholders if p not in found]
        extra = [p for p in found if p not in cls.KNOWN_PLACEHOLDERS]

        return {
            'found': found,
            'missing': missing,
            'unknown': extra,
            'valid': len(missing) == 0,
        }

    @classmethod
    def preview(cls, template, lead_data=None):
        """Generate preview with sample data

        Args:
            template: EmailTemplate instance
            lead_data: Optional dict with custom preview data

        Returns:
            dict: Rendered subject, html, plain, and placeholders
        """
        # Default sample data for preview
        sample_data = {
            'first_name': 'John',
            'last_name': 'Doe',
            'company': 'Acme Corp',
            'email': 'john.doe@example.com',
            'job_title': 'CEO',
            'phone': '(555) 123-4567',
            'website': 'https://acmecorp.com',
            'address': '123 Main St',
            'city': 'San Francisco',
            'state': 'CA',
            'zip_code': '94105',
            'country': 'United States',
            'unsubscribe_url': 'https://yourdomain.com/unsubscribe/',
            'tracking_pixel': 'https://yourdomain.com/track/open/',
            'greeting': 'John',
            'dashboard_url': 'https://app.crypgo.com/dashboard',
        }

        # Override with provided lead data
        if lead_data:
            sample_data.update(lead_data)

        # Get subject and content
        subject = template.subject if hasattr(template, 'subject') else ''
        html_content = template.html_content if hasattr(template, 'html_content') else ''
        plain_text = getattr(template, 'plain_text', '')

        return {
            'subject': cls.render_subject(subject, sample_data),
            'html': cls.render(html_content, sample_data),
            'plain': cls._simple_render(plain_text, sample_data),
            'placeholders': cls.get_placeholders(html_content),
        }

    @classmethod
    def render_for_lead(cls, lead, template, campaign=None, tracking_urls=None):
        """Render template for a specific lead

        Args:
            lead: Lead model instance
            template: EmailTemplate instance
            campaign: Optional Campaign instance for tracking
            tracking_urls: Optional dict with tracking URLs

        Returns:
            dict: Rendered content with tracking injected
        """
        # Build context from lead
        context = {
            'first_name': getattr(lead, 'first_name', ''),
            'last_name': getattr(lead, 'last_name', ''),
            'company': getattr(lead, 'company', ''),
            'email': lead.email,
            'greeting': getattr(lead, 'first_name', '') or 'there',
            'job_title': getattr(lead, 'job_title', ''),
            'phone': getattr(lead, 'phone', ''),
            'website': getattr(lead, 'website', ''),
            'address': getattr(lead, 'address', ''),
            'city': getattr(lead, 'city', ''),
            'state': getattr(lead, 'state', ''),
            'zip_code': getattr(lead, 'zip_code', ''),
            'country': getattr(lead, 'country', ''),
        }

        # Add tracking URLs if provided
        if tracking_urls:
            context.update(tracking_urls)

        # Add campaign info if provided
        if campaign:
            context['campaign_name'] = campaign.name
            context['campaign_id'] = campaign.pk

        # Get subject and content
        subject = template.subject if hasattr(template, 'subject') else ''
        html_content = template.html_content if hasattr(template, 'html_content') else ''
        plain_text = getattr(template, 'plain_text', '')

        return {
            'subject': cls.render_subject(subject, context),
            'html': cls.render(html_content, context),
            'plain': cls._simple_render(plain_text, context),
            'context': context,
        }
