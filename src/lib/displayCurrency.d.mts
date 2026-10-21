export function convertUsdAmount(amount: number, rate: number | undefined): number | null;

export function formatCurrencyFromUsd(
  amount: number,
  currency: string,
  rate: number | undefined,
  compact?: boolean,
): string;
