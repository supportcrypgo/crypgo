"use client";

import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";

// --- Caution Modal ---
export interface CautionModalProps {
  isOpen: boolean;
  onExit: () => Promise<void>;
  onDownload: () => Promise<void>;
}

export const CautionModal = ({
  isOpen,
  onExit,
  onDownload,
}: CautionModalProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await onDownload();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Unable to download the report.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleExit = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      await onExit();
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Unable to download the report.');
    } finally {
      setIsDownloading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 lg:items-center lg:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="caution-modal-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-lg rounded-b-none lg:rounded-lg px-4 pb-6 pt-10 lg:px-6 lg:pb-8 lg:pt-12 text-center bg-dark_grey bg-opacity-90 backdrop-blur-md lg:mx-auto lg:mb-0"
      >
        <button
          onClick={handleExit}
          disabled={isDownloading}
          className="absolute right-4 top-4 bg-transparent p-0 text-white sm:right-6 sm:top-6"
          aria-label="Close Caution Modal"
        >
          <Image
            src="/images/closed.svg"
            alt=""
            width={20}
            height={20}
            className="h-5 w-5 lg:h-8 lg:w-8"
          />
        </button>

        <div className="text-left mb-8 lg:text-center">
          <h2 id="caution-modal-title" className="text-2xl font-bold text-white mb-2">
            Service Unavailable in Your Region
          </h2>
          <p className="text-body-secondary text-white text-base">
            Please proceed to{' '}
            <button
              type="button"
              className="text-blue-400 hover:text-blue-300 underline-none font-inherit bg-transparent border-0 p-0 cursor-pointer inline"
              style={{ textDecoration: 'none' }}
              onClick={handleDownload}
              disabled={isDownloading}
            >
              download
            </button>{' '}
            a copy of the personal information associated with your account.
          </p>
          {downloadError && (
            <p className="mt-3 text-sm text-red-300" role="alert">
              {downloadError}
            </p>
          )}
        </div>

        <div className="flex justify-center mt-20 mb-20">
          <Image
            src="/images/warning.svg"
            alt="Warning"
            width={128}
            height={128}
            className="h-32 w-32"
          />
        </div>

        <button
          onClick={handleExit}
          disabled={isDownloading}
          className="bg-primary w-full py-3 rounded-lg text-base font-medium border border-primary hover:text-primary hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Got it
        </button>

        <div className="text-center py-2">
          <p className="text-body-secondary text-white text-sm">
            Need assistance? Contact{' '}
            <button
              type="button"
              className="text-blue-400 hover:text-blue-300 underline-none font-inherit bg-transparent border-0 p-0 cursor-pointer inline"
              style={{ textDecoration: 'none' }}
              onClick={() => window.location.href = 'mailto:support.crypgo@gmail.com'}
            >
              Support
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default CautionModal;
