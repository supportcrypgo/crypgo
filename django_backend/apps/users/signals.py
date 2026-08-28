"""
Django signals for the users app.

This module contains signal handlers that automatically create wallet assets
when a new non-superuser user is created.
"""
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model

from apps.users.models import WalletAsset

User = get_user_model()

# 11 supported assets from src/types/unified.ts AssetTicker
ASSET_DEFS = [
    ("BTC", "Bitcoin"),
    ("ETH", "Ethereum"),
    ("USDT", "Tether"),
    ("BNB", "BNB"),
    ("SOL", "Solana"),
    ("LTC", "Litecoin"),
    ("XRP", "XRP"),
    ("ADA", "Cardano"),
    ("DOT", "Polkadot"),
    ("DOGE", "Dogecoin"),
    ("LINK", "Chainlink"),
]


@receiver(post_save, sender=User)
def create_wallet_assets_for_new_user(sender, instance, created, **kwargs):
    """
    Automatically create 11 zero-balance wallet assets when a new non-superuser user is created.
    
    This signal fires after user creation (via registration, admin panel, or management commands)
    and ensures the user has wallet records for all supported assets with addresses generated
    on-demand and zero balances.
    """
    # Only create wallet assets for newly created non-superuser users
    if not created or instance.is_superuser or instance.is_staff:
        return

    # Check if wallet assets already exist (in case of race conditions or re-runs)
    existing_tickers = set(
        WalletAsset.objects.filter(user=instance).values_list("ticker", flat=True)
    )

    to_create = []
    for ticker, name in ASSET_DEFS:
        if ticker not in existing_tickers:
            to_create.append(
                WalletAsset(
                    user=instance,
                    ticker=ticker,
                    name=name,
                    quantity=0,
                    available_quantity=0,
                    locked_quantity=0,
                )
            )

    if to_create:
        WalletAsset.objects.bulk_create(to_create, ignore_conflicts=True)