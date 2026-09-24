from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import hashlib


ASSETS = [
    ('BTC', 'Bitcoin'), ('ETH', 'Ethereum'), ('USDT', 'Tether'),
    ('USDC', 'USD Coin'), ('BNB', 'BNB'), ('SOL', 'Solana'),
    ('LTC', 'Litecoin'), ('XRP', 'XRP'), ('ADA', 'Cardano'),
    ('DOT', 'Polkadot'), ('DOGE', 'Dogecoin'), ('LINK', 'Chainlink'),
]


def build_address(user_id, ticker):
    seed = hashlib.sha256(f'crypgo:{user_id}:{ticker}:mainnet'.encode('utf-8')).hexdigest()
    if ticker == 'BTC':
        return f'bc1{seed[:30]}'
    if ticker in ['ETH', 'USDT', 'USDC']:
        return f'0x{seed[:40]}'
    if ticker == 'SOL':
        return seed[:44]
    if ticker == 'LTC':
        return f'L{seed[:33]}'
    return seed[:40]


def backfill_addresses(apps, schema_editor):
    User = apps.get_model('users', 'CustomUser')
    WalletAddress = apps.get_model('users', 'WalletAddress')
    for user in User.objects.filter(is_staff=False, is_superuser=False).iterator():
        for ticker, _name in ASSETS:
            WalletAddress.objects.get_or_create(
                user_id=user.id,
                ticker=ticker,
                network='mainnet',
                defaults={'address': build_address(user.id, ticker)},
            )


class Migration(migrations.Migration):
    dependencies = [
        ('users', '0017_alter_customuser_managers_customuser_date_of_birth'),
    ]

    operations = [
        migrations.CreateModel(
            name='WalletAddress',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('ticker', models.CharField(max_length=10)),
                ('network', models.CharField(default='mainnet', max_length=40)),
                ('address', models.CharField(max_length=255)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='wallet_addresses', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'db_table': 'wallet_addresses',
                'unique_together': {('user', 'ticker', 'network'), ('network', 'address')},
            },
        ),
        migrations.AddIndex(model_name='walletaddress', index=models.Index(fields=['address', 'ticker', 'network'], name='wallet_addr_lookup_idx')),
        migrations.AddIndex(model_name='walletaddress', index=models.Index(fields=['user', 'ticker', 'network'], name='wallet_addr_user_idx')),
        migrations.RunPython(backfill_addresses, migrations.RunPython.noop),
    ]