import type { Prices } from '@/app/dashboard/components/types';
import type { UnifiedWalletAsset, UnifiedWalletSummary } from '@/types/unified';
import { TICKER_TO_COINGECKO_KEY } from '@/lib/priceMapping';

export function enrichWalletAssetsWithLivePrices(
  assets: UnifiedWalletAsset[],
  prices: Prices | null
): UnifiedWalletAsset[] {
  if (!prices) return assets;

  return assets.map((asset) => {
    const coingeckoKey = TICKER_TO_COINGECKO_KEY[asset.ticker];
    const priceEntry =
      coingeckoKey && typeof coingeckoKey === 'string'
        ? prices[coingeckoKey as keyof Prices]
        : undefined;

    const fallbackPrice = Number(asset.price ?? 0);
    const livePriceValue = priceEntry ? Number(priceEntry.usd ?? fallbackPrice) : fallbackPrice;
    const hasValidLivePrice = Number.isFinite(livePriceValue) && livePriceValue > 0;
    const livePrice = hasValidLivePrice ? livePriceValue : fallbackPrice;

    const live24hChangeValue = priceEntry ? Number(priceEntry.usd_24h_change ?? asset.change24h) : Number(asset.change24h ?? 0);
    const live24hChange = Number.isFinite(live24hChangeValue) ? live24hChangeValue : Number(asset.change24h ?? 0);
    const quantity = Number(asset.quantity ?? asset.availableQuantity ?? 0);

    return {
      ...asset,
      price: livePrice,
      change24h: live24hChange,
      value: quantity * livePrice,
    };
  });
}

export function deriveWalletSummary(assets: UnifiedWalletAsset[]): UnifiedWalletSummary {
  const totalBalance = assets.reduce((sum, asset) => {
    const quantity = Number(asset.quantity ?? 0);
    const price = Number(asset.price ?? 0);
    return sum + quantity * price;
  }, 0);

  const availableBalance = assets.reduce((sum, asset) => {
    const available = Number(asset.availableQuantity ?? 0);
    const price = Number(asset.price ?? 0);
    return sum + available * price;
  }, 0);

  const lockedBalance = assets.reduce((sum, asset) => {
    const locked = Number(asset.lockedQuantity ?? 0);
    const price = Number(asset.price ?? 0);
    return sum + locked * price;
  }, 0);

  return {
    totalBalance,
    availableBalance,
    lockedBalance,
    change24h: 2831.4,
    change24hPercentage: 2.41,
  };
}

export function aggregateWalletAmountsByTicker(
  assets: Pick<UnifiedWalletAsset, 'ticker' | 'quantity' | 'availableQuantity'>[],
  field: 'quantity' | 'availableQuantity'
): Record<string, number> {
  return assets.reduce<Record<string, number>>((acc, asset) => {
    const amount = Number(asset[field] ?? 0);
    acc[asset.ticker] = (acc[asset.ticker] ?? 0) + amount;
    return acc;
  }, {});
}
