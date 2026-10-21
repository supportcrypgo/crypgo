'use client';

import { useDisplayCurrency } from '@/context/DisplayCurrencyContext';
import CurrencyLoadingShimmer from './CurrencyLoadingShimmer';

interface CurrencyValueProps {
  amount: number;
  compact?: boolean;
  className?: string;
  shimmerClassName?: string;
}

export default function CurrencyValue({
  amount,
  compact = false,
  className = '',
  shimmerClassName = 'h-4 w-24',
}: CurrencyValueProps) {
  const { convertFromUsd, formatFromUsd } = useDisplayCurrency();

  if (convertFromUsd(amount) === null) {
    return <CurrencyLoadingShimmer className={shimmerClassName} />;
  }

  return <span className={className}>{formatFromUsd(amount, compact)}</span>;
}
