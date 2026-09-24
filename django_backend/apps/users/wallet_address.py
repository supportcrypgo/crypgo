import hashlib


def build_wallet_address(user_id: int, ticker: str, network: str = 'mainnet') -> str:
    """Build the stable platform address used for internal wallet routing."""
    asset = ticker.upper()
    network_name = network.lower()
    seed = hashlib.sha256(f"crypgo:{user_id}:{asset}:{network_name}".encode('utf-8')).hexdigest()

    if asset == 'BTC':
        return f'bc1{seed[:30]}'
    if asset in ['ETH', 'USDT', 'USDC']:
        return f'0x{seed[:40]}'
    if asset == 'SOL':
        return seed[:44]
    if asset == 'LTC':
        return f'L{seed[:33]}'
    return seed[:40]