"use client";

import Image from "next/image";
import { AlertCircle } from "lucide-react";
import { useState } from "react";

// --- Caution Modal ---
export interface CautionModalProps {
  isOpen: boolean;
  onExit: () => Promise<void> | void;
  onDownload: () => Promise<void>;
}

export const CautionModal = ({
  isOpen,
  onExit,
  onDownload,
}: CautionModalProps) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

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
        className="relative flex h-[550px] max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-t-lg rounded-b-none bg-dark_grey bg-opacity-90 px-4 pb-6 pt-10 text-center backdrop-blur-md lg:mx-auto lg:mb-0 lg:h-[645px] lg:rounded-lg lg:px-6 lg:pb-8 lg:pt-12"
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

        <div className="min-h-0 flex-1 overflow-y-auto text-left [scrollbar-width:none] lg:text-justify [&::-webkit-scrollbar]:hidden">
          <div className="mb-6 flex justify-center">
          <Image
            src="/images/warning.svg"
            alt="Warning"
            width={128}
            height={128}
            className="h-32 w-32"
          />
          </div>

          <div className="mb-8">
            <h2 id="caution-modal-title" className="mb-2 text-left text-2xl font-bold text-white">
              Service Unavailable in Your Region
            </h2>
            <p className="text-body-secondary text-base text-white">
              To remain compliant with regulatory requirements and regional licensing restrictions, access to this platform is currently restricted for U.S.-based users.
            </p>
            <h3 className="mb-3 mt-4 text-left text-2xl font-bold text-white">
              What can I do?
            </h3>
            <ol className="mb-16 list-decimal space-y-3 pl-6 text-base leading-6 text-white">
              <li>
                Please proceed to{' '}
                <button
                  type="button"
                  className="inline cursor-pointer border-0 bg-transparent p-0 font-inherit text-blue-400 underline-none hover:text-blue-300"
                  style={{ textDecoration: 'none' }}
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  download
                </button>{' '}
                a copy of the personal information associated with your account.
              </li>
              <li>
                If you have recently moved or believe this is an error, please update your billing address or region settings in your profile.
              </li>
              <li>
                If you need assistance accessing your data or closing your account, reach out to our{' '}
                <button
                  type="button"
                  className="inline cursor-pointer border-0 bg-transparent p-0 font-inherit text-blue-400 underline-none hover:text-blue-300"
                  style={{ textDecoration: 'none' }}
                  onClick={() => window.location.href = 'mailto:noreply@crypgo.com'}
                >
                  support team
                </button>.
              </li>
            </ol>
            {downloadError && (
              <p className="mt-3 text-sm text-red-300" role="alert">
                {downloadError}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleExit}
          disabled={isDownloading}
          className="bg-primary w-full py-3 rounded-lg text-base font-medium border border-primary hover:text-primary hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Got it
        </button>

      </div>
    </div>
  );
};

export default CautionModal;
