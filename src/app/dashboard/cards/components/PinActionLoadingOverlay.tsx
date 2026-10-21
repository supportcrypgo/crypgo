'use client';

import { LoaderCircle } from 'lucide-react';

export default function PinActionLoadingOverlay() {
  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-darkmode/60 backdrop-blur-md"
      role="status"
      aria-live="assertive"
    >
      <span className="sr-only">Please wait</span>
      <LoaderCircle className="h-10 w-10 animate-spin text-primary" aria-hidden="true" />
    </div>
  );
}
