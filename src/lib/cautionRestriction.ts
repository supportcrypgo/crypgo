const CAUTION_RESTRICTION_KEY = 'crypgo:caution-restriction-active';

export function markCautionRestrictionActive(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CAUTION_RESTRICTION_KEY, '1');
  }
}

export function isCautionRestrictionActive(): boolean {
  return typeof window !== 'undefined'
    && window.localStorage.getItem(CAUTION_RESTRICTION_KEY) === '1';
}

export function clearCautionRestriction(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(CAUTION_RESTRICTION_KEY);
  }
}