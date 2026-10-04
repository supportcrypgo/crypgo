"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Logo from "@/components/Layout/Header/Logo";
import { useAuth } from '@/hooks/useAuth';
import { AccountSelectionResponse, authApi } from '@/data/api';
import { useEffect } from 'react';

function maskAccountEmail(email: string) {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  if (localPart.length <= 5) {
    return `${localPart[0]}${'*'.repeat(localPart.length - 1)}@${domain}`;
  }
  return `${localPart.slice(0, 3)}${'*'.repeat(localPart.length - 5)}${localPart.slice(-2)}@${domain}`;
}

const Signin = ({ onSuccess, onPasswordChanged, magicLinkToken, passwordResetToken }: { onSuccess?: () => void; onPasswordChanged?: () => void; magicLinkToken?: string | null; passwordResetToken?: string | null }) => {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [resetTokenValid, setResetTokenValid] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountSelection, setAccountSelection] = useState<AccountSelectionResponse | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);

  const { login, selectLoginAccount } = useAuth();

  useEffect(() => {
    if (!magicLinkToken) {
      setTokenValid(null);
      return;
    }

    setTokenValid(null);
    authApi.consumeMagicLink(magicLinkToken)
      .then(() => setTokenValid(true))
      .catch((error: unknown) => {
        setTokenValid(false);
        setFormError(error instanceof Error ? error.message : 'This password-change link is invalid or already used.');
      });
  }, [magicLinkToken]);

  useEffect(() => {
    if (!passwordResetToken) {
      setResetTokenValid(null);
      return;
    }

    let cancelled = false;
    setResetTokenValid(null);
    setFormError('');
    authApi.confirmResetToken(passwordResetToken)
      .then(() => {
        if (!cancelled) setResetTokenValid(true);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setResetTokenValid(false);
        setFormError(error instanceof Error ? error.message : 'This password reset link is invalid or expired.');
      });

    return () => {
      cancelled = true;
    };
  }, [passwordResetToken]);

  const loginUser = async (email: string, password: string) => {
    setLoading(true);
    setFormError('');
    try {
      const result = await login(email, password);
      if (result) {
        setAccountSelection(result);
        setSelectedAccountId(result.accounts[0]?.id ?? null);
        return;
      }
      setFormError('');
      toast.success('Login successful');
      onSuccess?.();
    } catch (err: any) {
      const msg = typeof err?.message === 'string' && err.message.trim()
        ? err.message
        : 'Login failed.';
      console.error('[Signin.loginUser] error', msg, err);
      setFormError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const continueWithSelectedAccount = async () => {
    if (!accountSelection || selectedAccountId === null) return;
    setLoading(true);
    setFormError('');
    try {
      await selectLoginAccount(accountSelection.selection_token, selectedAccountId);
      setAccountSelection(null);
      toast.success('Login successful');
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to select this account.';
      setFormError(message);
      setAccountSelection(null);
      setSelectedAccountId(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    setFormError('');
    if (passwordResetToken) {
      if (newPassword !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        await authApi.resetPassword(passwordResetToken, newPassword, confirmPassword);
        toast.success('Password updated. Sign in with your new password.');
        onPasswordChanged?.();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Unable to update your password.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (magicLinkToken) {
      if (newPassword !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        await authApi.resetPassword(magicLinkToken, newPassword, confirmPassword);
        onPasswordChanged?.();
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Unable to update your password.');
      } finally {
        setLoading(false);
      }
      return;
    }
    if (isForgotPassword) {
      setLoading(true);
      try {
        await authApi.requestMagicLink(email);
        setRequestSent(true);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Unable to send the password-change email.');
      } finally {
        setLoading(false);
      }
      return;
    }
    await loginUser(email, password);
  };

  return (
    <>
      <div className="mb-10 text-center mx-auto inline-block max-w-[160px]">
        <Logo />
      </div>

      <h2 className="text-center text-2xl font-bold text-white mb-6">
        {magicLinkToken || passwordResetToken ? 'Change Password' : accountSelection ? 'Choose account' : isForgotPassword ? 'Forgot Password' : 'Sign In'}
      </h2>

      {passwordResetToken && resetTokenValid === null && !formError && (
        <p className="mb-6 text-sm text-body-secondary" role="status">Validating your password reset link...</p>
      )}
      {passwordResetToken && resetTokenValid === false && (
        <p className="mb-6 text-sm text-red-400" role="alert">{formError}</p>
      )}
      {magicLinkToken && tokenValid === null && !formError && (
        <p className="mb-6 text-sm text-body-secondary" role="status">Validating your password-change link...</p>
      )}
      {magicLinkToken && tokenValid === false && (
        <p className="mb-6 text-sm text-red-400" role="alert">{formError}</p>
      )}
      {(passwordResetToken && resetTokenValid === true) || (magicLinkToken && tokenValid === true) ? (
      <form onSubmit={handleSubmit}>
        <input
          name="new-password"
          type="password"
          placeholder="New Password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          minLength={8}
          autoComplete="new-password"
          required
          className="mb-[22px] w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-base text-white outline-none transition placeholder:text-grey focus:border-primary"
        />
        <input
          name="confirm-password"
          type="password"
          placeholder="Confirm New Password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          minLength={8}
          autoComplete="new-password"
          required
          className="mb-[22px] w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-base text-white outline-none transition placeholder:text-grey focus:border-primary"
        />
        <div className="mb-9">
          <button type="submit" disabled={loading} className="bg-primary w-full py-3 rounded-lg text-18 font-medium border border-primary hover:text-primary hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Updating...' : 'Change Password'}
          </button>
        </div>
      </form>
      ) : accountSelection ? (
        <div>
          <p className="mb-5 text-sm text-muted text-center">Choose which Crypgo account to open.</p>
          <fieldset className="mb-6 space-y-3">
            <legend className="sr-only">Choose an account</legend>
            {accountSelection.accounts.map((account) => (
              <label
                key={account.id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-left ${selectedAccountId === account.id ? 'border-primary bg-primary/10' : 'border-dark_border'}`}
              >
                <input
                  type="radio"
                  name="selected-account"
                  value={account.id}
                  checked={selectedAccountId === account.id}
                  onChange={() => setSelectedAccountId(account.id)}
                  className="accent-primary"
                />
                <span className="flex flex-col text-white">
                  <span className="font-medium">{account.label}</span>
                  <span className="text-sm text-muted">{maskAccountEmail(account.email_hint)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          {formError && <p className="mb-4 text-sm text-red-400" role="alert">{formError}</p>}
          <button
            type="button"
            onClick={continueWithSelectedAccount}
            disabled={loading || selectedAccountId === null}
            className="mb-4 w-full rounded-lg border border-primary bg-primary py-3 text-18 font-medium text-darkmode hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Opening account...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={() => {
              setAccountSelection(null);
              setSelectedAccountId(null);
              setFormError('');
            }}
            className="w-full bg-transparent py-2 text-white hover:text-primary"
          >
            Back to sign in
          </button>
        </div>
      ) : !magicLinkToken && !passwordResetToken ? <form onSubmit={handleSubmit}>
        <div className="mb-[22px]">
          <input
            name="email"
            type="email"
            placeholder="Email"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-base text-dark outline-none transition placeholder:text-grey focus:border-primary focus-visible:shadow-none text-white dark:focus:border-primary"
          />
        </div>
        {!isForgotPassword && (
          <div className="mb-[22px]">
            <input
              name="password"
              type="password"
              placeholder="Password"
              autoComplete="off"
              required
              className="w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-base text-dark outline-none transition placeholder:text-grey focus:border-primary focus-visible:shadow-none text-white dark:focus:border-primary"
            />
          </div>
        )}
        {requestSent && (
          <p className="mb-4 text-sm text-green-400" role="status">
            If an account exists, a password-change link has been sent.
          </p>
        )}
        {formError && (
          <p className="mb-4 text-sm text-red-400" aria-live="polite">
            {formError}
          </p>
        )}
        <div className="mb-9">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary w-full py-3 rounded-lg text-18 font-medium border border-primary hover:text-primary hover:bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (isForgotPassword ? 'Sending...' : 'Signing in...') : (isForgotPassword ? 'Send Link' : 'Sign In')}
          </button>
        </div>
      </form> : null}

      <button
        type="button"
        onClick={() => {
          setIsForgotPassword((current) => !current);
          setRequestSent(false);
          setFormError('');
        }}
        className="mb-2 inline-block border-none bg-transparent text-base text-white hover:text-primary"
      >
        {isForgotPassword ? 'Back to Password Sign In' : 'Forgot Password?'}
      </button>

      <p className="text-body-secondary text-white text-base">
        Not a member yet?{" "}
        <Link href="/?signup=1" className="text-primary hover:underline">
          Sign Up
        </Link>
      </p>
    </>
  );
};

export default Signin;