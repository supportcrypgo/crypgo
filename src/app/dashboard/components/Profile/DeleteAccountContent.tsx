'use client';

import { useState } from 'react';
import { AlertTriangle, Trash2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { profileApi } from '@/data/api';
import { useAuth } from '@/hooks/useAuth';

export function DeleteAccountContent() {
  const { logout } = useAuth();
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (!confirmChecked) {
      toast.error('Please confirm that you understand the consequences before continuing.');
      return;
    }

    setIsDeleting(true);

    try {
      const result = await profileApi.requestAccountDeletion();
      toast.success(result.message || 'Account deletion request submitted successfully.');

      if (result.success) {
        await logout({ redirect: true });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not process your request right now.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-full bg-red-500/10 text-red-500">
            <Trash2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-semibold">Delete Account</h2>
        </div>

        <p className="mt-4 text-muted-foreground">
          This action permanently removes your access to Crypgo and cannot be undone.
        </p>
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-foreground">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
          <div className="space-y-3">
            <p className="font-medium text-red-500">Before you continue</p>
            <ul className="space-y-2 list-disc pl-5 text-muted-foreground">
              <li>You will lose access to your wallet, holdings, and profile.</li>
              <li>You may need to contact support if you change your mind after the request is processed.</li>
              <li>Once the account is removed, this action is not reversible.</li>
            </ul>
          </div>
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-white/10 bg-background p-4 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={confirmChecked}
          onChange={(e) => setConfirmChecked(e.target.checked)}
          className="mt-1 h-4 w-4 accent-red-500"
        />
        <span>
          I understand that deleting my Crypgo account is permanent and I want to continue.
        </span>
      </label>

      <button
        type="button"
        onClick={handleDeleteAccount}
        disabled={isDeleting || !confirmChecked}
        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <AlertTriangle className="w-4 h-4" />
        {isDeleting ? 'Processing...' : 'Delete my account'}
      </button>
    </div>
  );
}
