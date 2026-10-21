export function convertUsdAmount(amount, rate) {
  if (!Number.isFinite(amount) || !Number.isFinite(rate) || rate <= 0) {
    return null;
  }
  return amount * rate;
}

export function formatCurrencyFromUsd(amount, currency, rate, compact = false) {
  const converted = convertUsdAmount(amount, rate);
  if (converted === null) return '—';

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: currency === 'JPY' ? 0 : 2,
  }).format(converted);
}
