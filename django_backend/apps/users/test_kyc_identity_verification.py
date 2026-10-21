from datetime import date
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from .kyc_screening import screen_document
from .models import CustomUser, KYCDocument


class KYCIdentityExtractionTests(TestCase):
    @patch(
        'apps.users.kyc_screening._extract_text',
        return_value='UNITED STATES OF AMERICA\nDate of Birth: 01/02/1980',
    )
    def test_extracts_birth_date_from_labeled_id_text(self, _extract_text):
        result = screen_document('id_front.webp', 'image/webp', 'id_front')

        self.assertEqual(result['extracted_data']['date_of_birth_candidate'], '1980-01-02')
        self.assertEqual(result['extracted_data']['country_candidate'], 'United States')
        self.assertEqual(result['extracted_data']['extraction_status'], 'complete')
        self.assertEqual(result['screening_status'], 'manual_review')

    @patch(
        'apps.users.kyc_screening._extract_text',
        return_value='123 Main Street\nSan Francisco, CA 94102\nUnited States',
    )
    def test_extracts_region_from_address_document(self, _extract_text):
        result = screen_document('proof_address.pdf', 'application/pdf', 'proof_address')

        self.assertEqual(result['extracted_data']['region_candidate'], 'California')

    @patch(
        'apps.users.kyc_screening._extract_text',
        return_value='P<USA\nI<USA123456789001010M300101',
    )
    def test_extracts_birth_date_from_a_passport_mrz(self, _extract_text):
        result = screen_document('id_front.webp', 'image/webp', 'id_front')

        self.assertEqual(result['extracted_data']['date_of_birth_candidate'], '1990-01-01')

    @patch('apps.users.kyc_screening._extract_text', return_value='')
    def test_marks_unreadable_documents_for_manual_review(self, _extract_text):
        result = screen_document('id_front.webp', 'image/webp', 'id_front')

        self.assertEqual(result['extracted_data']['extraction_status'], 'unavailable')
        self.assertIsNone(result['extracted_data']['date_of_birth_candidate'])
        self.assertEqual(result['screening_status'], 'manual_review')


class KYCIdentityApprovalTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = CustomUser.objects.create_user(
            username='kyc-user',
            email='kyc-user@example.com',
            password='Password123!',
            country='United States',
            date_of_birth=date(1990, 4, 3),
        )
        self.admin = CustomUser.objects.create_superuser(
            username='kyc-admin',
            email='kyc-admin@example.com',
            password='Password123!',
        )
        self.client.force_authenticate(self.admin)

    def _create_required_documents(self, include_identity_candidates=True):
        document_data = {
            'id_front': (
                {'date_of_birth_candidate': '1980-01-02'}
                if include_identity_candidates
                else {}
            ),
            'id_back': {},
            'proof_address': (
                {'region_candidate': 'California'}
                if include_identity_candidates
                else {}
            ),
            'selfie': {},
        }
        return [
            KYCDocument.objects.create(
                user=self.user,
                document_type=document_type,
                file_url=f'https://example.test/{document_type}.webp',
                original_filename=f'{document_type}.webp',
                file_size=100,
                extracted_data=extracted_data,
            )
            for document_type, extracted_data in document_data.items()
        ]

    def _approve(self, document):
        return self.client.post(
            f'/api/admin/kyc-documents/{document.pk}/review/',
            {'action': 'approve'},
            format='json',
        )

    def test_profile_identity_fields_are_updated_only_after_all_documents_are_approved(self):
        self.user.identity_details_verified = False
        self.user.save(update_fields=['identity_details_verified'])
        documents = self._create_required_documents()

        for document in documents[:-1]:
            response = self._approve(document)
            self.assertEqual(response.status_code, 200)
            self.user.refresh_from_db()
            self.assertFalse(self.user.identity_details_verified)

        response = self._approve(documents[-1])
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()

        self.assertEqual(self.user.kyc_status, 'verified')
        self.assertEqual(self.user.date_of_birth, date(1980, 1, 2))
        self.assertEqual(self.user.country, 'California')
        self.assertTrue(self.user.identity_details_verified)

    def test_profile_identity_fields_remain_hidden_when_ocr_did_not_extract_them(self):
        documents = self._create_required_documents(include_identity_candidates=False)

        for document in documents:
            response = self._approve(document)
            self.assertEqual(response.status_code, 200)

        self.user.refresh_from_db()
        self.assertEqual(self.user.kyc_status, 'verified')
        self.assertEqual(self.user.date_of_birth, date(1990, 4, 3))
        self.assertEqual(self.user.country, 'United States')
        self.assertFalse(self.user.identity_details_verified)

    def test_profile_api_does_not_allow_identity_field_edits(self):
        self.client.force_authenticate(self.user)

        payload = {'country': 'Canada', 'date_of_birth': '1980-01-02'}
        for method in (self.client.put, self.client.patch):
            response = method('/api/users/me/', payload, format='json')
            self.assertEqual(response.status_code, 400)

        self.user.refresh_from_db()
        self.assertEqual(self.user.country, 'United States')
        self.assertEqual(self.user.date_of_birth, date(1990, 4, 3))
