import type { NetworkOption } from './types';
import { SEND_ASSETS, validateAddress, generateTxId } from '@/data/assets';

export { SEND_ASSETS, validateAddress, generateTxId };

// Default selection helpers for backward compatibility
export function getSendAssets() {
  return SEND_ASSETS;
}