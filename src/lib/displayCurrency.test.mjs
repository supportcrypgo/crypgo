import assert from 'node:assert/strict';
import test from 'node:test';
import { convertUsdAmount, formatCurrencyFromUsd } from './displayCurrency.mjs';

test('converts USD amounts using a valid display rate', () => {
  assert.equal(convertUsdAmount(20, 1.5), 30);
});

test('does not convert when the amount or exchange rate is invalid', () => {
  assert.equal(convertUsdAmount(20, undefined), null);
  assert.equal(convertUsdAmount(Number.NaN, 1.5), null);
  assert.equal(convertUsdAmount(20, 0), null);
});

test('formats converted amounts in the selected currency', () => {
  assert.equal(formatCurrencyFromUsd(10, 'EUR', 0.9), '€9.00');
  assert.equal(formatCurrencyFromUsd(10, 'USD', 1), '$10.00');
});

test('uses compact notation for large values and hides values without rates', () => {
  assert.match(formatCurrencyFromUsd(1_000_000, 'USD', 1, true), /1M/);
  assert.equal(formatCurrencyFromUsd(10, 'EUR', undefined), '—');
});
