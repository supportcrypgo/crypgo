from django.test import TestCase
from django.contrib.auth import get_user_model
from apps.core.models import Setting


class CoreModelsTest(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

    def test_setting_creation(self):
        setting = Setting.objects.create(
            key='test_key',
            value='test_value',
            description='Test setting'
        )
        self.assertEqual(str(setting), 'test_key')
        self.assertEqual(setting.value, 'test_value')


class CoreAdminTest(TestCase):
    def setUp(self):
        self.admin_user = get_user_model().objects.create_superuser(
            username='admin',
            email='admin@example.com',
            password='adminpass123'
        )
        self.client.login(username='admin', password='adminpass123')

    def test_admin_dashboard_access(self):
        response = self.client.get('/admin/')
        self.assertEqual(response.status_code, 200)