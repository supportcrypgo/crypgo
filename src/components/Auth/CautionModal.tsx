"use client";

import Image from "next/image";
import { useEffect } from "react";

// --- Caution Modal ---
export interface CautionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CautionModal = ({
  isOpen,
  onClose,
}: CautionModalProps) => {
  useEffect(() => {
    if (!isOpen) return;

    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const previousHtmlOverflow = html.style.overflow;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyPosition = body.style.position;
    const previousBodyTop = body.style.top;
    const previousBodyWidth = body.style.width;

    html.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `-${scrollY}px`;
    body.style.width = '100%';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflow = previousHtmlOverflow;
      body.style.overflow = previousBodyOverflow;
      body.style.position = previousBodyPosition;
      body.style.top = previousBodyTop;
      body.style.width = previousBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 lg:items-center lg:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="caution-modal-title"
        className="relative w-full max-w-md overflow-hidden rounded-t-lg rounded-b-none lg:rounded-lg px-4 pb-6 pt-10 lg:px-6 lg:pb-8 lg:pt-12 text-center bg-dark_grey bg-opacity-90 backdrop-blur-md lg:mx-auto lg:mb-0"
      >
        <div className="mb-8 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div aria-hidden="true" />
          <h2 id="caution-modal-title" className="text-2xl font-bold text-white text-center">
            Something went wrong!
          </h2>
          <button
            onClick={onClose}
            className="justify-self-end flex h-9 w-9 items-center justify-center rounded-full bg-gray-500/40 text-white transition-colors hover:bg-gray-500/60"
            aria-label="Close caution modal"
          >
            <Image
              src="/images/closed.svg"
              alt=""
              width={20}
              height={20}
              className="h-5 w-5"
            />
          </button>
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

        <p className="mb-4 text-center text-base font-medium text-white">
          Need help? We&apos;re here.
        </p>

        <a
          href={`mailto:support.crypgo@gmail.com?subject=${encodeURIComponent('Help with my Crypgo account')}&body=${encodeURIComponent("Hi there,\n\nHere's what happened: [describe the issue in one or two lines].")}`}
          className="block bg-primary w-full py-3 rounded-lg text-base font-medium border border-primary hover:text-primary hover:bg-transparent"
        >
          Contact Us
        </a>
      </div>
    </div>
  );
};

export default CautionModal;
