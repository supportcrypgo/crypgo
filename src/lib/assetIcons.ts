const LOCAL_ASSET_ICONS: Record<string, string> = {
  BTC: '/images/icons/icon-bitcoin.svg',
  ETH: '/images/icons/icon-ethereum.svg',
  SOL: '/images/icons/icon-solana.svg',
  LTC: '/images/icons/icon-litecoin.svg',
  DOGE: '/images/icons/icon-dogecoin.svg',
};

export function getAssetIconPath(ticker: string, fallbackLogo?: string): string {
  return LOCAL_ASSET_ICONS[ticker.toUpperCase()] || fallbackLogo || '/images/icons/icon-blockchain.svg';
}
