from django.test import TestCase
from rest_framework.test import APIClient

from .models import CardDeliveryAddress, CustomUser


class CardDeliveryAddressAPITests(TestCase):
    endpoint = '/api/users/card-delivery-address/'

    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='card-address-user',
            email='card-address@example.com',
            password='Password123!',
        )
        self.other_user = CustomUser.objects.create_user(
            username='other-card-address-user',
            email='other-card-address@example.com',
            password='Password123!',
        )
        self.address = {
            'secondary_unit': 'Unit 4',
            'street_address': '123 Main Street',
            'city': 'San Francisco',
            'state': 'CA',
            'zip_code': '94105',
            'country': 'us',
        }

    def test_address_endpoint_requires_authentication(self):
        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 401)

    def test_get_reports_no_saved_address(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get(self.endpoint)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {'has_address': False, 'address': None})

    def test_user_can_save_and_read_only_their_own_address(self):
        self.client.force_authenticate(user=self.user)

        save_response = self.client.put(self.endpoint, self.address, format='json')

        self.assertEqual(save_response.status_code, 200, save_response.content)
        self.assertTrue(save_response.json()['has_address'])
        self.assertEqual(save_response.json()['address']['country'], 'US')
        self.assertEqual(CardDeliveryAddress.objects.count(), 1)
        self.assertEqual(CardDeliveryAddress.objects.get().user, self.user)

        read_response = self.client.get(self.endpoint)

        self.assertEqual(read_response.status_code, 200)
        self.assertEqual(read_response.json()['address']['street_address'], '123 Main Street')

        self.client.force_authenticate(user=self.other_user)
        other_user_response = self.client.get(self.endpoint)

        self.assertEqual(other_user_response.status_code, 200)
        self.assertEqual(other_user_response.json(), {'has_address': False, 'address': None})

    def test_save_rejects_invalid_country_code(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.put(
            self.endpoint,
            {**self.address, 'country': 'USA'},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn('country', response.json())
