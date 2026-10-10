from io import StringIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.core.management import call_command
from django.test import TestCase

from .models import CustomUser, WalletAddress, WalletAsset
from .signals import ASSET_DEFS


class ImportPeopleContactsCommandTests(TestCase):
    def write_roster(self, directory: str, contents: str) -> Path:
        source = Path(directory) / 'people.txt'
        source.write_text(contents, encoding='utf-8')
        return source

    def test_dry_run_previews_two_accounts_without_writing(self):
        with TemporaryDirectory() as directory:
            source = self.write_roster(directory, 'Jane, Doe <jane.doe@example.com>\n')
            output = StringIO()
            call_command('import_people_contacts', str(source), stdout=output)

        self.assertIn('planned new accounts: 2.', output.getvalue().lower())
        self.assertIn('Dry run only. No database changes were made.', output.getvalue())
        self.assertFalse(CustomUser.objects.filter(email__icontains='jane.doe').exists())

    def test_multi_email_rows_use_first_address_and_skip_unnamed_rows(self):
        with TemporaryDirectory() as directory:
            source = self.write_roster(
                directory,
                'Jane, Doe <jane@example.com>; <alternate@example.com>\n'
                '<unnamed@example.com> | <unnamed2@example.com>\n',
            )
            output = StringIO()
            call_command('import_people_contacts', str(source), stdout=output)

        summary = output.getvalue().lower()
        self.assertIn('planned new pairs: 1', summary)
        self.assertIn('planned new accounts: 2', summary)
        self.assertIn('unnamed rows skipped: 1', summary)
        self.assertFalse(CustomUser.objects.exists())

    def test_apply_creates_base_and_plus_one_with_shared_profile(self):
        with TemporaryDirectory() as directory:
            source = self.write_roster(directory, 'Jane, Doe <jane.doe@example.com>\n')
            with patch.dict('os.environ', {'CRYPGO_IMPORT_INITIAL_PASSWORD': 'Password123!'}):
                call_command('import_people_contacts', str(source), apply=True, yes=True)

        base = CustomUser.objects.get(email='jane.doe@example.com')
        alias = CustomUser.objects.get(email='jane.doe+1@example.com')
        for user in (base, alias):
            self.assertEqual(user.first_name, 'Jane')
            self.assertEqual(user.last_name, 'Doe')
            self.assertEqual(user.country, 'United States')
            self.assertTrue(user.is_active)
            self.assertEqual(user.role, 'user')
            self.assertTrue(user.check_password('Password123!'))
            self.assertEqual(WalletAsset.objects.filter(user=user).count(), len(ASSET_DEFS))
            self.assertEqual(WalletAddress.objects.filter(user=user).count(), len(ASSET_DEFS))

    @patch('builtins.input')
    def test_apply_skips_partial_pairs_without_modifying_existing_users(self, input_mock):
        existing = CustomUser.objects.create_user(
            username='existing-contact',
            email='existing@example.com',
            password='ExistingPassword123!',
            first_name='Original',
            last_name='Profile',
            country='Canada',
        )
        with TemporaryDirectory() as directory:
            source = self.write_roster(
                directory,
                'Changed, Name <existing@example.com>\n',
            )
            call_command('import_people_contacts', str(source), apply=True)

        existing.refresh_from_db()
        self.assertEqual(existing.first_name, 'Original')
        self.assertEqual(existing.last_name, 'Profile')
        self.assertEqual(existing.country, 'Canada')
        self.assertTrue(existing.check_password('ExistingPassword123!'))
        self.assertFalse(CustomUser.objects.filter(email='existing+1@example.com').exists())
        input_mock.assert_not_called()
