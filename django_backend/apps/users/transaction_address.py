import hashlib
import json


_BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l'
_BASE58_CHARSET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'


def _encode_digest(digest: bytes, charset: str, length: int) -> str:
    value = digest
    while len(value) < length:
        value += hashlib.sha256(value).digest()
    return ''.join(charset[byte % len(charset)] for byte in value[:length])


def build_transaction_address(
    user_email: str,
    ticker: str,
    transaction_index: int,
    transaction_type: str,
) -> str:
    """Build a repeatable, transaction-specific display address for seeded history."""
    identity = json.dumps(
        [
            user_email.strip().lower(),
            ticker.strip().upper(),
            transaction_index,
            transaction_type.strip().lower(),
        ],
        separators=(',', ':'),
    )
    digest = hashlib.sha256(identity.encode('utf-8')).digest()
    asset = ticker.strip().upper()

    if asset == 'BTC':
        return f'bc1q{_encode_digest(digest, _BECH32_CHARSET, 38)}'
    if asset in {'ETH', 'USDT', 'USDC'}:
        return f'0x{digest.hex()[:40]}'
    if asset == 'SOL':
        return _encode_digest(digest, _BASE58_CHARSET, 44)
    if asset == 'LTC':
        return f'L{_encode_digest(digest, _BASE58_CHARSET, 33)}'
    return digest.hex()[:40]
