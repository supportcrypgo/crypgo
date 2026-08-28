// ─── Unified Asset Catalog ───
// Single source of truth for all crypto assets across Send, Receive, Swap, and Portfolio

export type NetworkType = 
  | 'bitcoin' | 'ethereum' | 'tron' | 'bnb' | 'solana' 
  | 'polygon' | 'arbitrum' | 'optimism' | 'base' | 'avalanche' 
  | 'xrp' | 'cardano' | 'polkadot' | 'litecoin' | 'dogecoin';

export interface NetworkOption {
  id: NetworkType;
  name: string;
  shortName: string;
  addressPrefix: string;
  addressCharset: string;
  addressLength: number;
  addressType: 'bech32' | 'hex' | 'base58';
  memoRequired: boolean;
  memoLabel?: string;
  minDeposit: string;
  minDepositInUsd: string;
  confirmations: number;
  confirmationsLabel: string;
  estimatedArrival: string;
  feePercentage: number;
  explorerUrl: string;
  warning: string;
  badge?: string;
}

export interface CryptoAsset {
  id: string;
  name: string;
  ticker: string;
  logo: string;
  // Portfolio/price data
  price: number;
  change24h: number;
  value: number;
  percentage: number;
  // Wallet balances
  balance: string;
  availableQuantity?: number;
  quantity?: number;
  // Network support
  networks: NetworkOption[];
  defaultNetworkIndex: number;
}

// ─── Common Networks (single source of truth) ───
export const commonNetworks: Record<NetworkType, NetworkOption> = {
  bitcoin: {
    id: 'bitcoin',
    name: 'Bitcoin',
    shortName: 'BTC',
    addressPrefix: 'bc1q',
    addressCharset: 'qpzry9x8gf2tvdw0s3jn54khce6mua7l',
    addressLength: 42,
    addressType: 'bech32',
    memoRequired: false,
    minDeposit: '0.0001 BTC',
    minDepositInUsd: '≈ $6.75',
    confirmations: 3,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '10-30 min',
    feePercentage: 0.01,
    explorerUrl: 'https://mempool.space/tx/',
    warning: 'Send only BTC to this address. Sending other assets or using wrong network will result in permanent loss.',
  },
  ethereum: {
    id: 'ethereum',
    name: 'Ethereum',
    shortName: 'ERC-20',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '0.001 ETH',
    minDepositInUsd: '≈ $3.45',
    confirmations: 12,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '3-10 min',
    feePercentage: 0.01,
    explorerUrl: 'https://etherscan.io/tx/',
    warning: 'Send only ETH or ERC-20 tokens. Ensure smart contract compatibility for tokens.',
  },
  tron: {
    id: 'tron',
    name: 'Tron',
    shortName: 'TRC-20',
    addressPrefix: 'T',
    addressCharset: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    addressLength: 34,
    addressType: 'base58',
    memoRequired: false,
    minDeposit: '1 USDT',
    minDepositInUsd: '≈ $1.00',
    confirmations: 19,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '1-3 min',
    feePercentage: 0.01,
    explorerUrl: 'https://tronscan.org/#/transaction/',
    warning: 'Send only TRC-20 tokens. Lower fees but verify token is TRC-20 compatible.',
  },
  bnb: {
    id: 'bnb',
    name: 'BNB Smart Chain',
    shortName: 'BEP-20',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '0.001 BNB',
    minDepositInUsd: '≈ $0.58',
    confirmations: 15,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '1-3 min',
    feePercentage: 0.01,
    explorerUrl: 'https://bscscan.com/tx/',
    warning: 'Send only BEP-20 tokens. Not compatible with ERC-20 or other networks.',
  },
  solana: {
    id: 'solana',
    name: 'Solana',
    shortName: 'SPL',
    addressPrefix: '',
    addressCharset: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    addressLength: 44,
    addressType: 'base58',
    memoRequired: false,
    minDeposit: '0.01 SOL',
    minDepositInUsd: '≈ $1.48',
    confirmations: 32,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '5-20 sec',
    feePercentage: 0.01,
    explorerUrl: 'https://solscan.io/tx/',
    warning: 'Send only SPL tokens. Ensure you have SOL for transaction fees.',
  },
  polygon: {
    id: 'polygon',
    name: 'Polygon',
    shortName: 'ERC-20',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '1 MATIC',
    minDepositInUsd: '≈ $0.72',
    confirmations: 200,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '2-5 min',
    feePercentage: 0.01,
    explorerUrl: 'https://polygonscan.com/tx/',
    warning: 'Send only Polygon-native or bridged tokens. Verify contract address.',
  },
  arbitrum: {
    id: 'arbitrum',
    name: 'Arbitrum One',
    shortName: 'ERC-20',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '0.001 ETH',
    minDepositInUsd: '≈ $3.45',
    confirmations: 1,
    confirmationsLabel: 'L2 confirmations',
    estimatedArrival: '1-3 min',
    feePercentage: 0.01,
    explorerUrl: 'https://arbiscan.io/tx/',
    warning: 'Arbitrum One network only. Not compatible with Ethereum mainnet.',
  },
  optimism: {
    id: 'optimism',
    name: 'Optimism',
    shortName: 'ERC-20',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '0.001 ETH',
    minDepositInUsd: '≈ $3.45',
    confirmations: 1,
    confirmationsLabel: 'L2 confirmations',
    estimatedArrival: '1-3 min',
    feePercentage: 0.01,
    explorerUrl: 'https://optimistic.etherscan.io/tx/',
    warning: 'Optimism network only. Not compatible with Ethereum mainnet.',
  },
  base: {
    id: 'base',
    name: 'Base',
    shortName: 'ERC-20',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '0.001 ETH',
    minDepositInUsd: '≈ $3.45',
    confirmations: 1,
    confirmationsLabel: 'L2 confirmations',
    estimatedArrival: '1-3 min',
    feePercentage: 0.01,
    explorerUrl: 'https://basescan.org/tx/',
    warning: 'Base network only. Not compatible with Ethereum mainnet.',
  },
  avalanche: {
    id: 'avalanche',
    name: 'Avalanche C-Chain',
    shortName: 'C-Chain',
    addressPrefix: '0x',
    addressCharset: '0123456789abcdef',
    addressLength: 42,
    addressType: 'hex',
    memoRequired: false,
    minDeposit: '0.001 AVAX',
    minDepositInUsd: '≈ $0.04',
    confirmations: 15,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '1-2 sec',
    feePercentage: 0.01,
    explorerUrl: 'https://snowtrace.io/tx/',
    warning: 'Avalanche C-Chain only (not X-Chain or P-Chain).',
  },
  xrp: {
    id: 'xrp',
    name: 'XRP Ledger',
    shortName: 'XRP',
    addressPrefix: 'r',
    addressCharset: 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8o',
    addressLength: 34,
    addressType: 'base58',
    memoRequired: true,
    memoLabel: 'Destination Tag',
    minDeposit: '20 XRP',
    minDepositInUsd: '≈ $12.40',
    confirmations: 1,
    confirmationsLabel: 'Ledger close',
    estimatedArrival: '3-5 sec',
    feePercentage: 0.01,
    explorerUrl: 'https://xrpscan.com/tx/',
    warning: 'DESTINATION TAG REQUIRED. Funds sent without a tag may be lost or require manual recovery.',
  },
  cardano: {
    id: 'cardano',
    name: 'Cardano',
    shortName: 'ADA',
    addressPrefix: 'addr1',
    addressCharset: 'qpzry9x8gf2tvdw0s3jn54khce6mua7l',
    addressLength: 103,
    addressType: 'bech32',
    memoRequired: false,
    minDeposit: '5 ADA',
    minDepositInUsd: '≈ $2.40',
    confirmations: 15,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '1-2 min',
    feePercentage: 0.01,
    explorerUrl: 'https://cardanoscan.io/transaction/',
    warning: 'Send only ADA or native Cardano tokens. Shelley-era addresses only.',
  },
  polkadot: {
    id: 'polkadot',
    name: 'Polkadot',
    shortName: 'DOT',
    addressPrefix: '1',
    addressCharset: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    addressLength: 48,
    addressType: 'base58',
    memoRequired: false,
    minDeposit: '1 DOT',
    minDepositInUsd: '≈ $7.25',
    confirmations: 2,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '~1 min',
    feePercentage: 0.01,
    explorerUrl: 'https://polkadot.subscan.io/extrinsic/',
    warning: 'Send only DOT or Polkadot parachain assets. Verify address format.',
  },
  litecoin: {
    id: 'litecoin',
    name: 'Litecoin',
    shortName: 'LTC',
    addressPrefix: 'ltc1',
    addressCharset: 'qpzry9x8gf2tvdw0s3jn54khce6mua7l',
    addressLength: 42,
    addressType: 'bech32',
    memoRequired: false,
    minDeposit: '0.01 LTC',
    minDepositInUsd: '≈ $0.79',
    confirmations: 6,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '15-30 min',
    feePercentage: 0.01,
    explorerUrl: 'https://blockchair.com/litecoin/transaction/',
    warning: 'Send only LTC to this address.',
  },
  dogecoin: {
    id: 'dogecoin',
    name: 'Dogecoin',
    shortName: 'DOGE',
    addressPrefix: 'D',
    addressCharset: '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz',
    addressLength: 34,
    addressType: 'base58',
    memoRequired: false,
    minDeposit: '10 DOGE',
    minDepositInUsd: '≈ $1.00',
    confirmations: 6,
    confirmationsLabel: 'Block confirmations',
    estimatedArrival: '5-20 min',
    feePercentage: 0.01,
    explorerUrl: 'https://dogechain.info/tx/',
    warning: 'Send only DOGE to this address.',
  },
} as const;

// ─── Unified Asset Definitions ───
export const CRYPTO_ASSETS: CryptoAsset[] = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    ticker: 'BTC',
    logo: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    price: 63492.50,
    change24h: 2.34,
    value: 63492.50,
    percentage: 0,
    balance: '0.512349',
    availableQuantity: 1,
    quantity: 1,
    networks: [
      commonNetworks.bitcoin,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    ticker: 'ETH',
    logo: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    price: 3452.80,
    change24h: 1.89,
    value: 34528,
    percentage: 0,
    balance: '2.14382',
    availableQuantity: 10,
    quantity: 10,
    networks: [
      { ...commonNetworks.ethereum, badge: 'Recommended' },
      commonNetworks.arbitrum,
      commonNetworks.optimism,
      commonNetworks.base,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'tether',
    name: 'Tether',
    ticker: 'USDT',
    logo: 'https://assets.coingecko.com/coins/images/325/large/Tether-logo.png',
    price: 1.00,
    change24h: 0.01,
    value: 250.00,
    percentage: 0,
    balance: '250.00',
    networks: [
      { ...commonNetworks.tron, badge: 'Recommended' },
      commonNetworks.ethereum,
      commonNetworks.bnb,
      commonNetworks.polygon,
      commonNetworks.arbitrum,
      commonNetworks.optimism,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'binancecoin',
    name: 'BNB',
    ticker: 'BNB',
    logo: 'https://assets.coingecko.com/coins/images/825/large/binance-coin-logo.png',
    price: 580.00,
    change24h: 0.16,
    value: 11600.00,
    percentage: 0,
    balance: '12.58',
    availableQuantity: 20,
    quantity: 20,
    networks: [
      commonNetworks.bnb,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'xrp',
    name: 'XRP',
    ticker: 'XRP',
    logo: 'https://assets.coingecko.com/coins/images/44/large/xrp-symbol-white-128.png',
    price: 0.62,
    change24h: -0.45,
    value: 3360.40,
    percentage: 0,
    balance: '5,420.00',
    networks: [
      commonNetworks.xrp,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'solana',
    name: 'Solana',
    ticker: 'SOL',
    logo: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    price: 148.25,
    change24h: 4.12,
    value: 74125,
    percentage: 0,
    balance: '18.421',
    availableQuantity: 500,
    quantity: 500,
    networks: [
      commonNetworks.solana,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'cardano',
    name: 'Cardano',
    ticker: 'ADA',
    logo: 'https://assets.coingecko.com/coins/images/975/large/cardano.png',
    price: 0.48,
    change24h: 2.15,
    value: 5976.00,
    percentage: 0,
    balance: '12,450.00',
    networks: [
      commonNetworks.cardano,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'dogecoin',
    name: 'Dogecoin',
    ticker: 'DOGE',
    logo: 'https://assets.coingecko.com/coins/images/5/large/dogecoin.png',
    price: 0.10,
    change24h: 3.45,
    value: 10000.00,
    percentage: 0,
    balance: '100,000.00',
    networks: [
      commonNetworks.dogecoin,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'polkadot',
    name: 'Polkadot',
    ticker: 'DOT',
    logo: 'https://assets.coingecko.com/coins/images/12171/large/polkadot.png',
    price: 7.25,
    change24h: 3.21,
    value: 6452.50,
    percentage: 0,
    balance: '890.00',
    networks: [
      commonNetworks.polkadot,
    ],
    defaultNetworkIndex: 0,
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    ticker: 'LINK',
    logo: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
    price: 14.50,
    change24h: 2.89,
    value: 14500.00,
    percentage: 0,
    balance: '1,000.00',
    networks: [
      commonNetworks.ethereum,
    ],
    defaultNetworkIndex: 0,
  },
];

// ─── Helper Functions ───

/** Get asset by ID (e.g., 'bitcoin', 'ethereum') */
export function getAssetById(id: string): CryptoAsset | undefined {
  return CRYPTO_ASSETS.find(a => a.id === id);
}

/** Get asset by ticker (e.g., 'BTC', 'ETH') */
export function getAssetByTicker(ticker: string): CryptoAsset | undefined {
  return CRYPTO_ASSETS.find(a => a.ticker.toLowerCase() === ticker.toLowerCase());
}

/** Get all assets */
export function getAllAssets(): CryptoAsset[] {
  return CRYPTO_ASSETS;
}

// ─── Derived Lists for Different Flows ───

import type { SendAssetInfo, NetworkOption as SendNetworkOption } from '@/app/dashboard/wallet/send/components/types';
import type { ReceiveAssetInfo } from '@/app/dashboard/wallet/receive/components/types';
import type { SwapAsset } from '@/app/dashboard/components/SwapWorkspace/shared/types';
import type { Asset } from '@/app/dashboard/components/types';
import { getAssetIconPath } from '@/lib/assetIcons';

/** Convert unified asset to Send flow format */
export function toSendAsset(asset: CryptoAsset): SendAssetInfo {
  return {
    ticker: asset.ticker,
    name: asset.name,
    logo: asset.logo,
    balance: asset.balance,
    networks: asset.networks,
    defaultNetworkIndex: asset.defaultNetworkIndex,
  };
}

/** Convert unified asset to Receive flow format */
export function toReceiveAsset(asset: CryptoAsset): ReceiveAssetInfo {
  return {
    ticker: asset.ticker,
    name: asset.name,
    logo: asset.logo,
    networks: asset.networks,
    defaultNetworkIndex: asset.defaultNetworkIndex,
  };
}

/** Convert unified asset to Swap flow format */
export function toSwapAsset(asset: CryptoAsset): SwapAsset {
  return {
    id: asset.id,
    name: asset.name,
    ticker: asset.ticker,
    logo: getAssetIconPath(asset.ticker, asset.logo),
    price: asset.price,
    balance: parseFloat(asset.balance.replace(/,/g, '')),
  };
}

/** Convert unified asset to Portfolio/AssetConfig format */
export function toAssetConfig(asset: CryptoAsset): Asset {
  return {
    id: asset.id,
    name: asset.name,
    ticker: asset.ticker,
    logo: asset.logo,
    quantity: asset.quantity ?? 0,
    availableQuantity: asset.availableQuantity ?? 0,
    price: asset.price,
    value: asset.value,
    change24h: asset.change24h,
    percentage: asset.percentage,
  };
}

// ─── Exported Lists ───

/** Full list of assets for Send flow */
export const SEND_ASSETS = CRYPTO_ASSETS.map(toSendAsset);

/** Full list of assets for Receive flow */
export const RECEIVE_ASSETS = CRYPTO_ASSETS.map(toReceiveAsset);

/** Full list of assets for Swap flow */
export const SWAP_ASSETS = CRYPTO_ASSETS.map(toSwapAsset);

/** Full list of assets for Portfolio/Asset detail */
export const ASSET_CONFIG = CRYPTO_ASSETS.map(toAssetConfig);

// ─── Validation Helpers (re-exported for backward compatibility) ───

/** Validate an address against network format rules */
export function validateAddress(address: string, network: SendNetworkOption): { isValid: boolean; isValidNetwork: boolean; error?: string } {
  if (!address || address.trim().length === 0) {
    return { isValid: false, isValidNetwork: false, error: 'Enter recipient address' };
  }

  const cleanAddress = address.trim();
  
  if (network.addressPrefix && !cleanAddress.startsWith(network.addressPrefix)) {
    return { 
      isValid: false, 
      isValidNetwork: false, 
      error: `This address does not match the selected network (${network.name}). Expected prefix: ${network.addressPrefix}` 
    };
  }

  if (cleanAddress.length < network.addressLength - 5 || cleanAddress.length > network.addressLength + 5) {
    return { 
      isValid: false, 
      isValidNetwork: true, 
      error: `Invalid ${network.name} address length` 
    };
  }

  if (network.addressCharset) {
    const validChars = new Set(network.addressCharset.split(''));
    const hasInvalidChar = cleanAddress.split('').some(c => !validChars.has(c.toLowerCase()));
    if (hasInvalidChar) {
      return { 
        isValid: false, 
        isValidNetwork: true, 
        error: `Invalid characters in ${network.name} address` 
      };
    }
  }

  return { isValid: true, isValidNetwork: true };
}

/** Generate a mock transaction ID for a network */
export function generateTxId(network: SendNetworkOption): string {
  if (network.addressType === 'hex') {
    return '0x' + Array.from({ length: 64 }, () => 
      '0123456789abcdef'[Math.floor(Math.random() * 16)]
    ).join('');
  }
  return Array.from({ length: 64 }, () => 
    'abcdef0123456789'[Math.floor(Math.random() * 16)]
  ).join('');
}
