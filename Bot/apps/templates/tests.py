from django.test import TestCase
from types import SimpleNamespace
from apps.templates.models import EmailTemplate
from apps.templates.renderer import TemplateRenderer


class EmailTemplateModelTest(TestCase):
    def setUp(self):
        self.template = EmailTemplate.objects.create(
            name='Welcome Email',
            subject='Welcome {{ first_name }}!',
            html_content='<h1>Hello {{ first_name }} {{ last_name }}</h1>',
            plain_text='Hello {{ first_name }} {{ last_name }}',
            is_active=True
        )

    def test_template_creation(self):
        self.assertEqual(str(self.template), 'Welcome Email')
        self.assertTrue(self.template.is_active)

    def test_render_template(self):
        rendered = self.template.render({'first_name': 'John', 'last_name': 'Doe'})
        self.assertIn('John', rendered)
        self.assertIn('Doe', rendered)
        self.assertIn('<h1>', rendered)

    def test_clone_template(self):
        cloned = self.template.clone()
        self.assertEqual(cloned.name, 'Welcome Email (Copy)')
        self.assertFalse(cloned.is_active)


class TemplateRendererGreetingTest(TestCase):
    def test_render_for_recipient_includes_safe_greeting(self):
        template = EmailTemplate.objects.create(
            name='Greeting Template',
            subject='Hello {{ greeting }}',
            html_content='<p>Hello {{ greeting }},</p><p>{{ unsubscribe_url }}</p>',
            plain_text='Hello {{ greeting }},',
            is_active=True,
        )
        recipient = SimpleNamespace(
            email='john.doe@example.com',
            first_name='John',
            last_name='Doe',
        )

        rendered = TemplateRenderer.render_for_lead(recipient, template)

        self.assertEqual(rendered['context']['greeting'], 'John')
        self.assertIn('Hello John', rendered['subject'])
        self.assertIn('Hello John', rendered['html'])
