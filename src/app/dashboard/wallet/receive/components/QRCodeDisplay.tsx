'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
import { ReceiveAssetInfo, NetworkOption } from './types';

interface QRCodeDisplayProps {
  address?: string;
  memo?: string;
  network: NetworkOption;
  asset: ReceiveAssetInfo;
}

// Simple SVG QR code generator for demo purposes
// In production, use a proper library like `qrcode` or `react-qr-code`
function generateQRValue(address: string, network: NetworkOption, memo?: string): string {
  if (network.id === 'bitcoin') {
    return `bitcoin:${address}`;
  }
  if (network.id === 'ethereum' || network.id === 'bnb' || network.id === 'polygon' || 
      network.id === 'arbitrum' || network.id === 'optimism' || network.id === 'base' || 
      network.id === 'avalanche') {
    return `ethereum:${address}@${network.name.toLowerCase().replace(/\s+/g, '')}${memo ? `?value=${memo}` : ''}`;
  }
  if (network.id === 'solana') {
    return `solana:${address}${memo ? `?memo=${memo}` : ''}`;
  }
  if (network.id === 'xrp') {
    return `xrpl:${address}${memo ? `?dt=${memo}` : ''}`;
  }
  if (network.id === 'tron') {
    return `tron:${address}${memo ? `?memo=${memo}` : ''}`;
  }
  return `${network.id}:${address}`;
}

export default function QRCodeDisplay({ address, memo, network, asset }: QRCodeDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [qrSize, setQrSize] = useState(200);

  // Generate a deterministic pseudo-random QR-like pattern based on the address
  // This is a placeholder visualization - replace with real QR generation
  useEffect(() => {
    if (!canvasRef.current || !address) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate a hash from the address for deterministic pattern
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = ((hash << 5) - hash) + address.charCodeAt(i);
      hash |= 0;
    }

    const cells = 21; // QR v1 is 21x21
    const cellSize = qrSize / cells;
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, qrSize, qrSize);

    // Draw finder patterns (top-left, top-right, bottom-left)
    const drawFinderPattern = (x: number, y: number) => {
      ctx.fillStyle = '#0a0b14';
      // Outer square
      ctx.fillRect(x * cellSize, y * cellSize, cellSize * 7, cellSize * 7);
      // Inner white
      ctx.fillStyle = '#ffffff';
      ctx.fillRect((x + 1) * cellSize, (y + 1) * cellSize, cellSize * 5, cellSize * 5);
      // Inner black
      ctx.fillStyle = '#0a0b14';
      ctx.fillRect((x + 2) * cellSize, (y + 2) * cellSize, cellSize * 3, cellSize * 3);
    };

    drawFinderPattern(0, 0);
    drawFinderPattern(cells - 7, 0);
    drawFinderPattern(0, cells - 7);

    // Draw data cells based on hash
    for (let row = 0; row < cells; row++) {
      for (let col = 0; col < cells; col++) {
        // Skip finder pattern areas
        const inFinderArea = 
          (row < 8 && col < 8) ||
          (row < 8 && col >= cells - 8) ||
          (row >= cells - 8 && col < 8);
        
        if (inFinderArea) continue;

        // Pseudo-random but deterministic
        hash ^= hash << 13;
        hash ^= hash >> 17;
        hash ^= hash << 5;
        const bit = (hash >> (row * col % 32)) & 1;

        if (bit) {
          ctx.fillStyle = '#0a0b14';
          ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw border
    ctx.strokeStyle = '#0a0b14';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, qrSize - 2, qrSize - 2);
  }, [address, qrSize]);

  const handleDownload = () => {
    if (!canvasRef.current || !address) return;
    setIsDownloading(true);
    
    try {
      const link = document.createElement('a');
      link.download = `${asset.ticker}-${network.name.toLowerCase().replace(/\s+/g, '-')}-address.png`;
      link.href = canvasRef.current.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Failed to download QR code:', err);
    } finally {
      setTimeout(() => setIsDownloading(false), 1000);
    }
  };

  const qrValue = address ? generateQRValue(address, network, memo) : '';

  return (
    <div className="rounded-2xl bg-white/5 border border-white/5 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-white">QR Code</h3>
          <p className="text-xs text-charcoalGray">Scan to receive {asset.ticker}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
            <img src={asset.logo} alt={asset.name} className="w-5 h-5 rounded-full" />
          </div>
        </div>
      </div>
      <div className="p-6 flex flex-col items-center gap-4">
        {address ? (
          <>
            <div className="bg-white p-4 rounded-2xl shadow-sm">
              <canvas
                ref={canvasRef}
                width={qrSize}
                height={qrSize}
                className="block"
              />
            </div>
            <p className="text-xs text-charcoalGray text-center max-w-xs break-all">
              Address: <span className="text-white/75 font-mono">{address.slice(0, 16)}...{address.slice(-8)}</span>
            </p>
            {memo && (
              <p className="text-xs text-amber-300 text-center">
                Memo/Tag: <span className="font-mono">{memo}</span>
              </p>
            )}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/5 text-charcoalGray font-medium rounded-xl hover:bg-white/10 hover:text-white transition-colors border border-white/5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Downloading...' : 'Download QR'}
            </button>
          </>
        ) : (
          <div className="py-8 text-charcoalGray">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
            <p className="text-sm">Generating QR code...</p>
          </div>
        )}
      </div>
    </div>
  );
}