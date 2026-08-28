'use client';

import { UnifiedUser, UnifiedWalletAsset, UnifiedTransaction } from '@/types/unified';

// ─── Configuration ───
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '/backend-api';
const isLocalBrowser =
  typeof window === 'undefined' ||
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1';
const API_BASE_URL = isLocalBrowser ? configuredApiBaseUrl : '/backend-api';
const ACCESS_TOKEN_STORAGE_KEY = 'access_token';

function getAccessToken(): string | null {
  return typeof window !== 'undefined'
    ? localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)
    : null;
}

function clearAccessToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  }
}

function extractErrorMessage(errorData: unknown, status?: number): string {
  if (!errorData || typeof errorData !== 'object') {
    return status ? `Login failed (${status}). Check console for details.` : 'Something went wrong.';
  }

  const data = errorData as Record<string, unknown>;

  // Helper to extract first string from various error formats
  const getFirstString = (value: unknown): string | null => {
    if (typeof value === 'string') {
      return value.trim() || null;
    }
    if (Array.isArray(value) && value.length > 0) {
      // DRF returns arrays like ["Invalid email or password."]
      const first = value[0];
      if (typeof first === 'string') return first.trim() || null;
      // Nested object in array
      if (first && typeof first === 'object') {
        return getFirstString(first);
      }
    }
    if (value && typeof value === 'object') {
      // Handle nested objects (e.g., { detail: "..." } or { non_field_errors: [...] })
      for (const key of Object.keys(value as Record<string, unknown>)) {
        const nested = getFirstString((value as Record<string, unknown>)[key]);
        if (nested) return nested;
      }
    }
    return null;
  };

  // Priority order for DRF error formats:
  // 1. detail (common DRF format)
  // 2. non_field_errors (serializer validation errors)
  // 3. message (custom format)
  // 4. error (custom format)
  // 5. errors (alternative format)
  // 6. Field-specific errors (first one found)
  const extractedMessage = 
    getFirstString(data.detail) ||
    getFirstString(data.non_field_errors) ||
    getFirstString(data.message) ||
    getFirstString(data.error) ||
    getFirstString(data.errors) ||
    // Check for field-specific errors (e.g., { email: ["This field is required."] })
    (() => {
      for (const key of Object.keys(data)) {
        if (!['detail', 'non_field_errors', 'message', 'error', 'errors'].includes(key)) {
          const fieldError = getFirstString(data[key]);
          if (fieldError) return `${key}: ${fieldError}`;
        }
      }
      return null;
    })();

  if (extractedMessage) {
    return extractedMessage;
  }

  return status ? `Login failed (${status}). Check console for details.` : 'Something went wrong.';
}

function handleUnauthorized(): Promise<never> {
  clearAccessToken();
  if (
    typeof window !== 'undefined' &&
    !window.location.pathname.startsWith('/admin') &&
    !window.location.pathname.startsWith('/dashboard/admin') &&
    window.location.pathname !== '/'
  ) {
    window.location.replace('/');
  }
  return new Promise<never>(() => {});
}

function normalizeUser(user: any): UnifiedUser {
  const firstName = user?.first_name || user?.firstName || user?.username || '';
  const lastName = user?.last_name || user?.lastName || '';
  const initials = [firstName, lastName]
    .filter(Boolean)
    .map((part: string) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);

  return {
    id: String(user?.id ?? ''),
    firstName,
    lastName,
    email: user?.email || '',
    phone: user?.phone || '',
    country: user?.country || user?.location || '',
    dateOfBirth: user?.date_of_birth || user?.dateOfBirth || user?.dob || '',
    password: '',
    avatarInitials: initials || (user?.email?.[0]?.toUpperCase() || 'U'),
    role: (user?.role === 'admin' || user?.role === 'merchant' || user?.role === 'trader' ? user?.role : 'trader') as UnifiedUser['role'],
    status: user?.is_active ? 'active' : 'pending',
    emailVerified: Boolean(user?.email_verified ?? true),
    phoneVerified: Boolean(user?.phone_verified ?? false),
    createdAt: user?.date_joined || user?.created_at || '',
    lastLoginAt: user?.last_login || user?.lastLoginAt || '',
  };
}

function normalizeWalletAsset(asset: any): UnifiedWalletAsset {
  const quantity = Number(asset?.quantity ?? 0);
  const availableQuantity = Number(asset?.available_quantity ?? asset?.availableQuantity ?? 0);
  const lockedQuantity = Number(asset?.locked_quantity ?? asset?.lockedQuantity ?? 0);
  const price = Number(asset?.price ?? 0);

  return {
    id: String(asset?.id ?? ''),
    userId: String(asset?.user ?? asset?.user_id ?? ''),
    ticker: (asset?.ticker || '').toUpperCase(),
    name: asset?.name || asset?.ticker || '',
    logo: asset?.logo || '',
    quantity,
    availableQuantity,
    lockedQuantity,
    price,
    value: Number(asset?.value ?? quantity * price),
    change24h: Number(asset?.change24h ?? asset?.change_24h ?? 0),
    percentage: Number(asset?.percentage ?? asset?.change_24h_percentage ?? 0),
  };
}

function normalizeTransaction(tx: any): UnifiedTransaction {
  return {
    id: String(tx?.id ?? ''),
    userId: String(tx?.user ?? tx?.user_id ?? ''),
    type: (tx?.transaction_type || tx?.type || 'deposit') as UnifiedTransaction['type'],
    asset: (tx?.asset || 'BTC') as UnifiedTransaction['asset'],
    amount: Number(tx?.amount ?? 0),
    price: Number(tx?.price_at_time ?? tx?.price ?? 0),
    totalValue: Number(tx?.fiat_amount ?? tx?.amount ?? 0),
    status: (tx?.status || 'completed') as UnifiedTransaction['status'],
    counterpartyType: 'internal',
    counterpartyId: tx?.counterparty ? String(tx.counterparty) : undefined,
    walletAddress: tx?.to_address || tx?.from_address || undefined,
    fee: Number(tx?.fee ?? 0),
    feeAsset: tx?.asset as UnifiedTransaction['feeAsset'],
    description: tx?.memo || undefined,
    createdAt: tx?.created_at || '',
  };
}

// ─── Types ───
export interface ApiError {
  message: string;
  status?: number;
  data?: any;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface TokenResponse {
  access_token: string;
  refresh?: string;
  user?: UnifiedUser;
}

export interface ChangePasswordData {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface EmailPreferences {
  portfolio_activity: boolean;
  security_alerts: boolean;
  product_updates: boolean;
  marketing: boolean;
}

// ─── New Types for Profile Features ───

export interface UserSession {
  id: number;
  device_name: string;
  browser: string;
  operating_system: string;
  ip_address: string;
  location: string;
  is_current: boolean;
  last_active: string;
  created_at: string;
}

export interface KYCDocument {
  id: number;
  document_type: 'id_front' | 'id_back' | 'proof_address' | 'selfie';
  file: string;
  file_name: string;
  file_size: number;
  status: 'pending' | 'approved' | 'rejected';
  uploaded_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
}

export interface KYCDocumentUpload {
  document_type: 'id_front' | 'id_back' | 'proof_address' | 'selfie';
  file: File;
}

export interface UserActivityLog {
  id: number;
  action: string;
  description: string;
  ip_address: string;
  user_agent: string;
  location: string;
  metadata: Record<string, any>;
  created_at: string;
}

export interface ChangeAvatarResponse {
  avatar: string;
  message: string;
}



// ─── Notification Types ───
export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface NotificationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Notification[];
}

export interface UnreadCountResponse {
  unread_count: number;
}

export interface NotificationMarkReadData {
  notification_ids?: number[];
  mark_all?: boolean;
}

export interface PushSubscription {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface SubscribePushData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

// ─── Security Types ───
export interface DeviceFingerprint {
  id: number;
  user_agent: string;
  browser: string;
  browser_version: string;
  os: string;
  os_version: string;
  device_type: string;
  screen_resolution: string;
  language: string;
  timezone: string;
  platform: string;
  cores: number;
  memory: number;
  first_seen: string;
  last_seen: string;
  is_current: boolean;
  ip_address: string;
  location_city: string;
  location_country: string;
  location_latitude: number | null;
  location_longitude: number | null;
  location_accuracy: number | null;
}

export interface DeviceFingerprintListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: DeviceFingerprint[];
}

export interface VerifyLocationData {
  ip_address: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
}

export interface VerifyLocationResponse {
  verified: boolean;
  distance_km?: number;
  risk_score?: number;
  message: string;
}

export interface BrowserLocationRequestResponse {
  success: boolean;
  message: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
}

export interface SearchUsersByIdResponse {
  users: Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    username: string;
  }>;
}

export interface SearchUsersByNameResponse {
  users: Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    username: string;
  }>;
}

export interface SecurityHealthResponse {
  two_fa_enabled: boolean;
  active_sessions: number;
  trusted_devices: number;
  recent_logins: number;
  last_security_check: string;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendations: {
    id: string;
    title: string;
    completed: boolean;
    description: string;
  }[];
}

// ─── Translation Types ───
export interface TransactionTranslation {
  id: number;
  transaction: string;
  target_language: string;
  source_text: string;
  translated_text: string;
  translation_type: string;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface TransactionTranslationListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TransactionTranslation[];
}

export interface CreateTranslationData {
  target_language: string;
  source_text: string;
  translation_type: string;
}

// ─── Internal Transfer Types ───
export interface InternalTransfer {
  id: number;
  sender: number;
  sender_name: string;
  recipient: number;
  recipient_name: string;
  asset: string;
  amount: string;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  sender_transaction_id: string | null;
  recipient_transaction_id: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface InternalTransferListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: InternalTransfer[];
}

// ─── Wallet Snapshot Types ───
export interface WalletSnapshot {
  id: number;
  user: number;
  total_value_usd: string;
  assets: Record<string, { quantity: string; price: string; value: string }>;
  created_at: string;
}

export interface WalletSnapshotListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: WalletSnapshot[];
}

export interface CreateSnapshotData {
  total_value_usd: string;
  assets: Record<string, { quantity: string; price: string; value: string }>;
}

// ─── 2FA Types ───
export interface TwoFASetupResponse {
  secret: string;
  qr_code_url: string;
  backup_codes: string[];
}

export interface TwoFAVerifyData {
  code: string;
}

// ─── Helper: Make authenticated API request ───
async function authenticatedRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const accessToken = getAccessToken();
  if (accessToken && !headers.Authorization) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Handle 401 Unauthorized
  if (response.status === 401) {
    return handleUnauthorized();
  }

  // Handle 403 Forbidden
  if (response.status === 403) {
    throw new Error('You do not have permission to perform this action.');
  }

  // Handle 404 Not Found
  if (response.status === 404) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Resource not found.');
  }

  // Handle other errors
  if (response.status >= 400) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || errorData.message || 'An error occurred.'
    );
  }

  // Handle empty responses (e.g., 204 No Content)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function downloadUserReport(userId?: string | number): Promise<{
  blob: Blob;
  filename: string | null;
}> {
  const endpoint = userId === undefined
    ? '/users/report/'
    : `/admin/users/${userId}/report/`;

  const requestReport = () => {
    const headers: Record<string, string> = {};
    const accessToken = getAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return fetch(`${API_BASE_URL}${endpoint}`, {
      headers,
      credentials: 'include',
    });
  };

  let response = await requestReport();
  if (response.status === 401) {
    await authApi.refreshToken();
    response = await requestReport();
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      extractErrorMessage(errorData, response.status) || 'Unable to download the report.'
    );
  }

  const contentDisposition = response.headers.get('Content-Disposition');
  const filenameMatch = contentDisposition?.match(/filename="?([^";]+)"?/i);

  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] ?? null,
  };
}

// ─── Public Registration API (no auth required) ───

export const publicApi = {
  /**
   * Register new user (public endpoint - no auth required)
   */
  async registerUser(data: {
    email: string;
    username: string;
    password: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    country?: string;
  }): Promise<{ user: UnifiedUser }> {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || errorData.message || 'Registration failed.'
      );
    }

    return response.json();
  },
};

// ─── Auth API ───

export const authApi = {
  /**
   * Login user - tokens are set as http-only cookies by the backend
   */
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    console.log('[authApi.login] request start', { email: credentials.email });
    const response = await fetch(`${API_BASE_URL}/auth/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });

    console.log('[authApi.login] response status', response.status);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = extractErrorMessage(errorData, response.status) || 'Login failed.';
      console.error('[authApi.login] response error', { 
        status: response.status, 
        statusText: response.statusText,
        errorData, 
        message 
      });
      throw new Error(message);
    }

    const data = await response.json();
    console.log('[authApi.login] response data', data);
    if (data?.access_token && typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
    }

    return data;
  },

  /**
   * Register new user
   */
  async register(
    credentials: RegisterCredentials
  ): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || errorData.message || 'Registration failed.'
      );
    }

    return response.json();
  },

  /**
   * Logout user - calls backend to blacklist token and clear cookies
   */
  async logout(): Promise<void> {
    await authenticatedRequest('/auth/logout/', {
      method: 'POST',
    });
    clearAccessToken();
  },

  /**
   * Refresh the access token using the http-only refresh token cookie
   */
  async refreshToken(): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Token refresh failed.');
    }

    const data = await response.json().catch(() => null);
    if (data?.access_token && typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
    }
  },

  /**
   * Request password reset
   */
  async forgotPassword(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || errorData.message || 'Password reset request failed.'
      );
    }
  },

  async requestMagicLink(email: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/magic-link/request/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      throw new Error('Sign-in link request failed.');
    }
  },

  async consumeMagicLink(token: string): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/magic-link/consume/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(extractErrorMessage(data, response.status));
    }
    if (data.access_token && typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
    }
    return data;
  },

  async consumeCampaignAccess(token: string): Promise<TokenResponse> {
    const response = await fetch(`${API_BASE_URL}/auth/campaign-access/consume/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(extractErrorMessage(data, response.status));
    }
    if (data.access_token && typeof window !== 'undefined') {
      localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, data.access_token);
    }
    return data;
  },

  /**
   * Confirm password reset token
   */
  async confirmResetToken(token: string): Promise<void> {
    const response = await fetch(
      `${API_BASE_URL}/auth/reset-password/confirm/?token=${token}`
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || errorData.message || 'Token validation failed.'
      );
    }
  },

  /**
   * Update password with reset token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password/update/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || errorData.message || 'Password update failed.'
      );
    }
  },
};

// ─── User Profile API ───

export const profileApi = {
  /**
   * Get current user profile
   */
  async getMe(): Promise<UnifiedUser> {
    const response = await authenticatedRequest<any>('/users/me/');
    return normalizeUser(response);
  },

  /**
   * Update current user profile
   */
  async updateMe(data: Partial<UnifiedUser>): Promise<UnifiedUser> {
    const payload: Record<string, any> = {};
    if (data.firstName !== undefined) payload.first_name = data.firstName;
    if (data.lastName !== undefined) payload.last_name = data.lastName;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.country !== undefined) payload.country = data.country;
    if (data.dateOfBirth !== undefined) payload.date_of_birth = data.dateOfBirth;
    if ((data as any).location !== undefined) payload.country = (data as any).location;

    const response = await authenticatedRequest<any>('/users/me/', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return normalizeUser(response);
  },

  /**
   * Upload a new avatar image
   */
  async uploadAvatar(file: File): Promise<{ success: boolean; avatar_url: string }> {
    const formData = new FormData();
    formData.append('avatar', file);

    const response = await fetch(`${API_BASE_URL}/users/avatar/`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'Avatar upload failed.');
    }

    return response.json();
  },

  /**
   * Change the authenticated user's password
   */
  async changePassword(data: ChangePasswordData): Promise<{ success: boolean; message: string }> {
    return authenticatedRequest<{ success: boolean; message: string }>('/auth/change-password/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Get the authenticated user's email notification preferences
   */
  async getEmailPreferences(): Promise<EmailPreferences> {
    return authenticatedRequest<EmailPreferences>('/users/email-preferences/');
  },

  /**
   * Update the authenticated user's email notification preferences
   */
  async updateEmailPreferences(data: EmailPreferences): Promise<EmailPreferences> {
    return authenticatedRequest<EmailPreferences>('/users/email-preferences/', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// ─── Wallet API (Authenticated User) ───

export interface DepositAddressResponse {
  asset: string;
  address: string;
  qrCode?: string;
  network: string;
  minDeposit?: string;
  memo?: string;
}

export interface WithdrawResponse {
  success: boolean;
  message: string;
  transaction: {
    id: string;
    txid: string;
    type: string;
    asset: string;
    amount: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    from_address: string;
    to_address: string;
    fee: string;
  };
}

export interface WithdrawCompleteResponse {
  success: boolean;
  message: string;
  transaction: any;
}

export interface TransferResponse {
  success: boolean;
  message: string;
  transaction: any;
}

export interface BuyResponse {
  success: boolean;
  message: string;
  transaction: any;
}

export interface SwapResponse {
  success: boolean;
  message: string;
  transaction: any;
}

export interface SimulateDepositResponse {
  success: boolean;
  message: string;
  transaction: any;
}

export interface TransactionListResponse {
  id: string;
  txid: string;
  transaction_type: string;
  asset: string;
  amount: string;
  fiat_amount: string;
  price_at_time: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  from_address: string;
  to_address: string;
  fee: string;
  counterparty: string;
  memo: string;
  destination_asset: string;
  destination_amount: string;
}

export const walletApi = {
  /**
   * Get authenticated user's wallet assets
   */
  async getMyWallet(): Promise<UnifiedWalletAsset[]> {
    const response = await authenticatedRequest<any[]>('/wallet/assets/');
    return Array.isArray(response) ? response.map(normalizeWalletAsset) : [];
  },

  /**
   * Update a specific wallet asset (owner only)
   */
  async updateAsset(pk: string | number, data: Partial<UnifiedWalletAsset>): Promise<UnifiedWalletAsset> {
    return authenticatedRequest<UnifiedWalletAsset>(
      `/wallet/assets/${pk}/`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get deposit address for an asset
   */
  async getDepositAddress(asset: string): Promise<DepositAddressResponse> {
    return authenticatedRequest<DepositAddressResponse>('/wallet/deposit-address/', {
      method: 'POST',
      body: JSON.stringify({ asset }),
    });
  },

  /**
   * Withdraw crypto to external address
   */
  async withdraw(data: {
    asset: string;
    amount: number;
    to_address: string;
    network?: string;
    memo?: string;
    fee_level?: string;
  }): Promise<WithdrawResponse> {
    return authenticatedRequest<WithdrawResponse>('/wallet/withdraw/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Simulate withdrawal completion (for testing/demo)
   */
  async withdrawComplete(txid: string): Promise<WithdrawCompleteResponse> {
    return authenticatedRequest<WithdrawCompleteResponse>(`/wallet/withdraw/complete/${txid}/`, {
      method: 'POST',
    });
  },

  /**
   * Transfer funds internally between users
   */
  async transfer(data: {
    recipient: string;
    asset: string;
    amount: number;
    memo?: string;
  }): Promise<TransferResponse> {
    return authenticatedRequest<TransferResponse>('/wallet/transfer/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Buy crypto with fiat (USD)
   */
  async buy(data: {
    asset: string;
    amount_usd: number;
  }): Promise<BuyResponse> {
    return authenticatedRequest<BuyResponse>('/wallet/buy/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Swap one crypto asset for another
   */
  async swap(data: {
    from_asset: string;
    to_asset: string;
    amount: number;
  }): Promise<SwapResponse> {
    return authenticatedRequest<SwapResponse>('/wallet/swap/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Simulate a deposit (for testing/demo)
   */
  async simulateDeposit(asset: string): Promise<SimulateDepositResponse> {
    return authenticatedRequest<SimulateDepositResponse>('/wallet/simulate-deposit/', {
      method: 'POST',
      body: JSON.stringify({ asset }),
    });
  },

  /**
   * Get user's transaction history
   */
  async getTransactions(params?: {
    type?: string;
    asset?: string;
    status?: string;
  }): Promise<any[]> {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.append('type', params.type);
    if (params?.asset) searchParams.append('asset', params.asset);
    if (params?.status) searchParams.append('status', params.status);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    const response = await authenticatedRequest<any[]>(`/wallet/transactions/${query}`);
    return Array.isArray(response) ? response.map(normalizeTransaction) : [];
  },
};



// ─── Notifications API ───

export const notificationsApi = {
  /**
   * List notifications
   */
  async list(params?: { unread_only?: boolean; page?: number; page_size?: number }): Promise<NotificationListResponse> {
    const searchParams = new URLSearchParams();
    if (params?.unread_only) searchParams.append('unread_only', 'true');
    if (params?.page) searchParams.append('page', String(params.page));
    if (params?.page_size) searchParams.append('page_size', String(params.page_size));
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return authenticatedRequest<NotificationListResponse>(`/users/notifications/${query}`);
  },

  /**
   * Get unread count
   */
  async getUnreadCount(): Promise<UnreadCountResponse> {
    return authenticatedRequest<UnreadCountResponse>('/users/notifications/unread-count/');
  },

  /**
   * Mark notifications as read
   */
  async markRead(data: NotificationMarkReadData): Promise<{ success: boolean }> {
    return authenticatedRequest<{ success: boolean }>('/users/notifications/mark-read/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a notification
   */
  async delete(id: number): Promise<void> {
    return authenticatedRequest<void>(`/users/notifications/${id}/`, {
      method: 'DELETE',
    });
  },

  /**
   * Get push subscription
   */
  async getPushSubscription(): Promise<PushSubscription[]> {
    return authenticatedRequest<PushSubscription[]>('/users/notifications/push-subscription/');
  },

  /**
   * Subscribe to push notifications
   */
  async subscribePush(data: SubscribePushData): Promise<PushSubscription> {
    return authenticatedRequest<PushSubscription>('/users/notifications/push-subscription/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribePush(id: number): Promise<void> {
    return authenticatedRequest<void>(`/users/notifications/push-subscription/${id}/`, {
      method: 'DELETE',
    });
  },
};

// ─── Security API ───

export const securityApi = {
  /**
   * Get device fingerprints
   */
  async getDevices(): Promise<DeviceFingerprintListResponse> {
    return authenticatedRequest<DeviceFingerprintListResponse>('/users/security/devices/');
  },

  /**
   * Verify device location
   */
  async verifyLocation(data: VerifyLocationData): Promise<VerifyLocationResponse> {
    return authenticatedRequest<VerifyLocationResponse>('/users/security/devices/verify-location/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Request browser geolocation
   */
  async requestBrowserLocation(): Promise<BrowserLocationRequestResponse> {
    return authenticatedRequest<BrowserLocationRequestResponse>('/users/security/browser-location-request/', {
      method: 'POST',
    });
  },

  /**
   * Search users by ID prefix
   */
  async searchById(prefix: string): Promise<SearchUsersByIdResponse> {
    return authenticatedRequest<SearchUsersByIdResponse>(`/users/security/search-by-id/?prefix=${prefix}`);
  },

  /**
   * Search users by name/email
   */
  async searchByName(query: string): Promise<SearchUsersByNameResponse> {
    return authenticatedRequest<SearchUsersByNameResponse>(`/users/security/search-by-name/?query=${query}`);
  },

  /**
   * Get security health overview
   */
  async getHealth(): Promise<SecurityHealthResponse> {
    return authenticatedRequest<SecurityHealthResponse>('/users/security/health/');
  },
};

// ─── Translation API ───

export const translationsApi = {
  /**
   * List translations for a transaction
   */
  async list(txid: string): Promise<TransactionTranslationListResponse> {
    return authenticatedRequest<TransactionTranslationListResponse>(`/transactions/${txid}/translations/`);
  },

  /**
   * Create a translation
   */
  async create(txid: string, data: CreateTranslationData): Promise<TransactionTranslation> {
    return authenticatedRequest<TransactionTranslation>(`/transactions/${txid}/translations/create/`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

// ─── Internal Transfer API ───

export const internalTransfersApi = {
  /**
   * List internal transfers
   */
  async list(): Promise<InternalTransferListResponse> {
    return authenticatedRequest<InternalTransferListResponse>('/wallet/internal-transfers/');
  },

  /**
   * Get internal transfer detail
   */
  async getDetail(id: number): Promise<InternalTransfer> {
    return authenticatedRequest<InternalTransfer>(`/wallet/internal-transfers/${id}/`);
  },
};

// ─── Wallet Snapshots API ───

export const snapshotsApi = {
  /**
   * List wallet snapshots
   */
  async list(): Promise<WalletSnapshotListResponse> {
    return authenticatedRequest<WalletSnapshotListResponse>('/wallet/snapshots/');
  },

  /**
   * Create a wallet snapshot
   */
  async create(data: CreateSnapshotData): Promise<WalletSnapshot> {
    return authenticatedRequest<WalletSnapshot>('/wallet/snapshots/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Delete a wallet snapshot
   */
  async delete(id: number): Promise<void> {
    return authenticatedRequest<void>(`/wallet/snapshots/${id}/`, {
      method: 'DELETE',
    });
  },
};

// ─── 2FA API ───

export const twoFAApi = {
  /**
   * Setup 2FA
   */
  async setup(): Promise<TwoFASetupResponse> {
    return authenticatedRequest<TwoFASetupResponse>('/users/2fa/setup/');
  },

  /**
   * Verify 2FA code
   */
  async verify(data: TwoFAVerifyData): Promise<{ success: boolean }> {
    return authenticatedRequest<{ success: boolean }>('/users/2fa/verify/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Disable 2FA
   */
  async disable(): Promise<{ success: boolean }> {
    return authenticatedRequest<{ success: boolean }>('/users/2fa/disable/', {
      method: 'POST',
    });
  },
};

// ─── Admin API ───

export const adminApi = {
  /**
   * Get all users (admin only)
   */
  async getUsers(): Promise<UnifiedUser[]> {
    const response = await authenticatedRequest<any[]>('/admin/users/');
    return Array.isArray(response) ? response.map(normalizeUser) : [];
  },

  /**
   * Get specific user (admin only)
   */
  async getUser(pk: string | number): Promise<UnifiedUser> {
    const response = await authenticatedRequest<any>(`/admin/users/${pk}/`);
    return normalizeUser(response);
  },

  /**
   * Create new user (admin only)
   */
  async createUser(data: Partial<UnifiedUser>): Promise<UnifiedUser> {
    const response = await authenticatedRequest<any>('/admin/users/create/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return normalizeUser(response);
  },

  /**
   * Update user (admin only)
   */
  async updateUser(pk: string | number, data: Partial<UnifiedUser>): Promise<UnifiedUser> {
    const response = await authenticatedRequest<any>(`/admin/users/${pk}/update/`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return normalizeUser(response);
  },

  /**
   * Delete user (admin only)
   */
  async deleteUser(pk: string | number): Promise<void> {
    return authenticatedRequest<void>(`/admin/users/${pk}/delete/`, {
      method: 'DELETE',
    });
  },

  /**
   * Get specific user's wallet assets (admin only)
   */
  async getUserWallet(userId: string | number): Promise<UnifiedWalletAsset[]> {
    return authenticatedRequest<UnifiedWalletAsset[]>(
      `/admin/users/${userId}/wallet/`
    );
  },

  /**
   * Update specific user's wallet asset quantity by ticker (admin only)
   */
  async updateUserAssetByTicker(
    userId: string | number,
    ticker: string,
    data: { quantity?: number; available_quantity?: number; locked_quantity?: number }
  ): Promise<UnifiedWalletAsset> {
    return authenticatedRequest<UnifiedWalletAsset>(
      `/admin/users/${userId}/wallet/${ticker.toUpperCase()}/`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  /**
   * Get specific user's snapshots (admin only)
   */
  async getUserSnapshots(userId: string | number): Promise<any[]> {
    return authenticatedRequest<any[]>(
      `/admin/users/${userId}/snapshots/`
    );
  },

  /**
   * Create snapshot for specific user (admin only)
   */
  async createUserSnapshot(
    userId: string | number,
    snapshotData: any
  ): Promise<any> {
    return authenticatedRequest<any>(
      `/admin/users/${userId}/snapshots/create/`,
      {
        method: 'POST',
        body: JSON.stringify(snapshotData),
      }
    );
  },
};

// ─── Admin: KYC Document Review API ───

export const adminKycApi = {
  /**
   * Get all KYC documents (admin only)
   */
  async getDocuments(): Promise<KYCDocument[]> {
    return authenticatedRequest<KYCDocument[]>('/admin/kyc-documents/');
  },

  /**
   * Review (approve/reject) a KYC document
   */
  async reviewDocument(pk: number, action: 'approve' | 'reject', rejection_reason?: string): Promise<KYCDocument> {
    return authenticatedRequest<KYCDocument>(`/admin/kyc-documents/${pk}/review/`, {
      method: 'POST',
      body: JSON.stringify({ action, rejection_reason }),
    });
  },
};

// ─── Admin: User Activity Log API ───

export const adminActivityApi = {
  /**
   * Get activity log for a specific user (admin only)
   */
  async getUserActivities(userId: number): Promise<UserActivityLog[]> {
    return authenticatedRequest<UserActivityLog[]>(`/admin/users/${userId}/activity-log/`);
  },
};

// ─── Session Management API ───

export const sessionApi = {
  /**
   * Get authenticated user's device sessions
   */
  async getSessions(): Promise<UserSession[]> {
    return authenticatedRequest<UserSession[]>('/users/sessions/');
  },

  /**
   * Revoke a specific session
   */
  async revokeSession(pk: number): Promise<void> {
    return authenticatedRequest<void>(`/users/sessions/${pk}/`, {
      method: 'DELETE',
    });
  },

  /**
   * Revoke all sessions except current
   */
  async revokeAllSessions(): Promise<void> {
    return authenticatedRequest<void>('/users/sessions/revoke-all/', {
      method: 'POST',
    });
  },
};

// ─── KYC Document API ───

export const kycApi = {
  /**
   * Get authenticated user's KYC documents
   */
  async getDocuments(): Promise<KYCDocument[]> {
    return authenticatedRequest<KYCDocument[]>('/users/kyc-documents/');
  },

  /**
   * Upload a KYC document
   */
  async uploadDocument(data: FormData): Promise<KYCDocument> {
    const response = await fetch(`${API_BASE_URL}/users/kyc-documents/upload/`, {
      method: 'POST',
      body: data,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || errorData.message || 'Document upload failed.');
    }

    return response.json();
  },

  /**
   * Delete a KYC document
   */
  async deleteDocument(pk: number): Promise<void> {
    return authenticatedRequest<void>(`/users/kyc-documents/${pk}/`, {
      method: 'DELETE',
    });
  },
};

// ─── Activity Log API ───

export const activityApi = {
  /**
   * Get authenticated user's activity log
   */
  async getActivities(params?: { action?: string; start_date?: string; end_date?: string }): Promise<UserActivityLog[]> {
    const queryParams = new URLSearchParams();
    if (params?.action) queryParams.set('action', params.action);
    if (params?.start_date) queryParams.set('start_date', params.start_date);
    if (params?.end_date) queryParams.set('end_date', params.end_date);
    
    const query = queryParams.toString();
    const endpoint = `/users/activity-log/${query ? `?${query}` : ''}`;
    return authenticatedRequest<UserActivityLog[]>(endpoint);
  },
};

// ─── Exports ───

export const registerUser = publicApi.registerUser;
