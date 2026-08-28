from django.db import models


class EmailTemplate(models.Model):
    """Email template with HTML and plain text versions"""
    name = models.CharField(max_length=255, unique=True)
    subject = models.CharField(max_length=500)
    html_content = models.TextField(help_text="HTML content with placeholders like {{first_name}}, {{last_name}}")
    plain_text = models.TextField(blank=True, null=True, help_text="Plain text fallback version")
    attachment = models.FileField(upload_to='attachments/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    spam_score = models.FloatField(default=0.0, help_text="Spam score from spam check")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Email Template"
        verbose_name_plural = "Email Templates"
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def render(self, context):
        """Render template with context variables"""
        from django.template import Template, Context
        html_template = Template(self.html_content)
        rendered = html_template.render(Context(context))
        return rendered

    def clone(self):
        """Create a copy of this template"""
        from copy import deepcopy
        cloned = deepcopy(self)
        cloned.pk = None
        cloned.name = f"{self.name} (Copy)"
        cloned.is_active = False
        cloned.save()
        return cloned
