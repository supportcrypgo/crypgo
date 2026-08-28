'use client';

import { useState, useCallback } from 'react';
import { internalTransfersApi } from '@/data/api';
import type { 
  InternalTransfer, 
  InternalTransferListResponse 
} from '@/data/api';

export interface InternalTransferHook {
  transfers: InternalTransfer[];
  isLoading: boolean;
  error: string | null;
  fetchTransfers: () => Promise<void>;
  getTransferDetail: (id: number) => Promise<InternalTransfer>;
}

export function useInternalTransfer(): InternalTransferHook {
  const [transfers, setTransfers] = useState<InternalTransfer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTransfers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await internalTransfersApi.list();
      setTransfers(response.results || response);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch internal transfers');
      console.error('fetchTransfers error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getTransferDetail = useCallback(async (id: number) => {
    return internalTransfersApi.getDetail(id);
  }, []);

  return {
    transfers,
    isLoading,
    error,
    fetchTransfers,
    getTransferDetail,
  };
}