'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { useDisplayCurrency } from '@/context/DisplayCurrencyContext';
import CurrencyLoadingShimmer from '@/app/dashboard/components/CurrencyLoadingShimmer';

const currencyDisplayNames = new Intl.DisplayNames(['en'], { type: 'currency' });

interface CurrencyContentProps {
  onCurrencySelected: () => void;
}

export default function CurrencyContent({ onCurrencySelected }: CurrencyContentProps) {
  const { currency, rates, ratesError, ratesLoading, setCurrency, currencySaveError, refreshRates } = useDisplayCurrency();
  const [search, setSearch] = useState('');
  const [savingCurrency, setSavingCurrency] = useState(false);
  const currencyOptions = useMemo(
    () => Array.from(new Set(['USD', ...Object.keys(rates)])).sort((left, right) =>
      left === 'USD' ? -1 : right === 'USD' ? 1 : left.localeCompare(right),
    ),
    [rates],
  );
  const filteredCurrencies = currencyOptions.filter((code) => {
    const name = currencyDisplayNames.of(code) || code;
    const query = search.trim().toLocaleLowerCase();
    return !query || code.toLocaleLowerCase().includes(query) || name.toLocaleLowerCase().includes(query);
  });

  const chooseCurrency = async (code: string) => {
    setSavingCurrency(true);
    try {
      if (await setCurrency(code)) onCurrencySelected();
    } finally {
      setSavingCurrency(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-7">
      <section>
        <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          Current display currency
        </p>
        <p className="mt-2 text-2xl font-semibold text-white">
          {currency}
          <span className="ml-2 text-base font-normal text-muted-foreground">
            {currencyDisplayNames.of(currency) || currency}
          </span>
        </p>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Choose how fiat values appear across your dashboard. This preference is saved to your Crypgo account and applies across your devices. It does not change your balances or verified region.
        </p>
      </section>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search currencies"
          placeholder="Search by currency name or code"
          className="h-12 w-full rounded-xl border border-white/10 bg-darkmode pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary"
        />
      </div>

      {!rates[currency] && (
        <div aria-live="polite">
          <CurrencyLoadingShimmer className="h-3 w-24" />
        </div>
      )}
      {ratesError && (
        <div className="flex flex-wrap items-center gap-3 text-sm" aria-live="polite">
          <span className="text-red-400">Exchange rates unavailable: {ratesError}</span>
          <button type="button" onClick={() => void refreshRates()} className="text-primary hover:underline">
            Retry
          </button>
        </div>
      )}
      {currencySaveError && <p className="text-sm text-red-400" role="alert">{currencySaveError}</p>}

      {ratesLoading && currencyOptions.length === 1 ? (
        <div className="space-y-3" aria-label="Loading currencies">
          <CurrencyLoadingShimmer className="h-14 w-full rounded-xl" />
          <CurrencyLoadingShimmer className="h-14 w-full rounded-xl" />
          <CurrencyLoadingShimmer className="h-14 w-full rounded-xl" />
        </div>
      ) : filteredCurrencies.length > 0 ? (
        <div className="divide-y divide-white/[0.07]" role="listbox" aria-label="Display currencies">
          {filteredCurrencies.map((code) => {
            const selected = code === currency;
            return (
              <button
                key={code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => chooseCurrency(code)}
                disabled={savingCurrency}
                className={`flex min-h-16 w-full items-center gap-4 px-4 text-left transition-colors sm:px-5 ${
                  selected ? 'bg-primary/[0.08]' : 'bg-white/[0.015] hover:bg-white/[0.06]'
                }`}
              >
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold tracking-wide ${
                  selected ? 'bg-primary/15 text-primary' : 'bg-white/[0.06] text-muted-foreground'
                }`}>
                  {code}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-white">{currencyDisplayNames.of(code) || code}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{code}</span>
                </span>
                {selected && <Check className="h-5 w-5 shrink-0 text-primary" aria-label="Selected" />}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-white/10 px-4 py-8 text-center text-sm text-muted-foreground">
          No currencies match “{search}”.
        </p>
      )}
    </div>
  );
}
