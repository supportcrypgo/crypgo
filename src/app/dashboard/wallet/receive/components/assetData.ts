import type { NetworkOption, ReceiveAssetInfo } from './types';
import { RECEIVE_ASSETS as UNIFIED_RECEIVE_ASSETS } from '@/data/assets';

export const RECEIVE_ASSETS: ReceiveAssetInfo[] = UNIFIED_RECEIVE_ASSETS;

// Helper to generate realistic-looking addresses for demo purposes
export function generateAddress(network: NetworkOption): string {
  const { addressPrefix, addressCharset, addressLength, addressType } = network;
  const prefixLen = addressPrefix.length;
  const remainingLen = addressLength - prefixLen;
  
  let result = addressPrefix;
  for (let i = 0; i < remainingLen; i++) {
    result += addressCharset[Math.floor(Math.random() * addressCharset.length)];
  }
  
  return result;
}

export function generateMemo(network: NetworkOption): string | undefined {
  if (!network.memoRequired) return undefined;
  // XRP destination tag: 10 digits typically
  return Math.floor(100000000 + Math.random() * 900000000).toString();
}

export function generateTxId(network: NetworkOption): string {
  if (network.addressType === 'hex') {
    return '0x' + Array.from({ length: 64 }, () => 
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
  }
  return Array.from({ length: 64 }, () => 
    'abcdef0123456789'[Math.floor(Math.random() * 16)]
  ).join('');
}