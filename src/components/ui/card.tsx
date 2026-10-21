'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, X } from 'lucide-react';

import { cn } from '@/utils/utils';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';

interface CreditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActivate: (code: string) => Promise<void>;
  mobileSheet?: boolean;
}

export function CardDialog({
  open,
  onOpenChange,
  onActivate,
  mobileSheet = false,
}: CreditCardDialogProps) {
  const [code, setCode] = React.useState('');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setCode('');
      setError(null);
      setIsProcessing(false);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isProcessing) {
        onOpenChange(false);
      }
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isProcessing, onOpenChange, open]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const activationCode = code.trim();
    if (!activationCode || isProcessing) return;

    setError(null);
    setIsProcessing(true);
    try {
      await onActivate(activationCode);
      onOpenChange(false);
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : 'The card could not be activated. Please try again.'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn(
            'fixed inset-0 z-[100] flex overflow-y-auto bg-black/75 backdrop-blur-sm',
            mobileSheet
              ? 'items-end justify-center px-0 py-0 lg:items-center lg:p-4'
              : 'items-center justify-center px-4 py-6'
          )}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isProcessing) {
              onOpenChange(false);
            }
          }}
        >
          <motion.section
            role="dialog"
            aria-modal="true"
            aria-labelledby="card-activation-title"
            aria-describedby="card-activation-description"
            className={cn(
              'relative w-full overflow-y-auto border border-white/10 bg-[#0b101c] text-white shadow-2xl shadow-black/60',
              mobileSheet
                ? 'max-h-[94dvh] max-w-none rounded-t-lg rounded-b-none lg:max-w-[460px] lg:rounded-3xl'
                : 'max-w-[460px] overflow-hidden rounded-3xl'
            )}
            initial={{ y: 18, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 12, scale: 0.98, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="flex items-start justify-between gap-4 px-6 pt-6">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold tracking-tight text-white">Crypgo Classic</h2>
                <p className="mt-1 text-sm leading-relaxed text-charcoalGray">
                  One card connected to your crypto.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={isProcessing}
                aria-label="Close activation dialog"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 pt-5">
              <FlippableCreditCard
                cvv="•••"
                className="mx-auto max-w-[340px]"
              />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="px-6 pb-5 pt-6">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                  Virtual card
                </p>
                <h2 id="card-activation-title" className="text-xl font-semibold tracking-tight">
                  Activate your card
                </h2>
                <p id="card-activation-description" className="mt-2 text-sm leading-relaxed text-charcoalGray">
                  Enter the activation code provided for your Crypgo card.
                </p>

                <label htmlFor="activation-code" className="mb-2 mt-5 block text-xs font-medium text-white/80">
                  Activation code
                </label>
                <input
                  id="activation-code"
                  autoFocus
                  autoComplete="one-time-code"
                  placeholder="Enter activation code"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={isProcessing}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'activation-error' : undefined}
                  className={cn(
                    'h-11 w-full rounded-xl border bg-white/[0.04] px-3.5 text-sm text-white outline-none transition placeholder:text-charcoalGray focus:border-primary/60 focus:ring-2 focus:ring-primary/10 disabled:opacity-60',
                    error ? 'border-red-400/60' : 'border-white/10'
                  )}
                />
                {error && (
                  <p id="activation-error" role="alert" className="mt-2 text-xs leading-relaxed text-red-300">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={!code.trim() || isProcessing}
                  className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-darkmode transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isProcessing ? 'Activating…' : 'Activate card'}
                </button>
              </div>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
