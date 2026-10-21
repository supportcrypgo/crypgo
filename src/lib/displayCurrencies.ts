export type DisplayCurrency = string;

export function getCurrencySymbol(currency: DisplayCurrency): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    })
      .formatToParts(0)
      .find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}
