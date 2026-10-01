from django.test import SimpleTestCase, override_settings


@override_settings(
    ROOT_URLCONF='core.urls',
    CRYPGO_EMAIL_TRACKING_URL='https://Crypgoemail.pythonanywhere.com/track',
)
class LegacyClickTrackingRelayTests(SimpleTestCase):
    def test_api_host_tracking_link_relays_to_email_host_preserving_query(self):
        response = self.client.get(
            '/track/click/legacy-id-123/?url=https%3A%2F%2Fcrypgo-gamma.vercel.app%2F%3FresetToken%3Dabc'
        )

        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.url,
            'https://Crypgoemail.pythonanywhere.com/track/click/legacy-id-123/'
            '?url=https%3A%2F%2Fcrypgo-gamma.vercel.app%2F%3FresetToken%3Dabc',
        )

    def test_api_host_tracking_link_without_trailing_slash_relays(self):
        response = self.client.get('/track/click/legacy-id-123?url=%2Faccount')

        self.assertEqual(response.status_code, 302)
        self.assertEqual(
            response.url,
            'https://Crypgoemail.pythonanywhere.com/track/click/legacy-id-123/'
            '?url=%2Faccount',
        )