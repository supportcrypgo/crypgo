"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Logo from "@/components/Layout/Header/Logo";
import { useAuth } from '@/hooks/useAuth';
import { AccountSelectionResponse, authApi } from '@/data/api';
import { useEffect } from 'react';

type FirstLoginStep = 'verify-code' | 'confirm-password';

function maskAccountEmail(email: string) {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return email;
  if (localPart.length <= 5) {
    return `${localPart[0]}${'*'.repeat(localPart.length - 1)}@${domain}`;
  }
  return `${localPart.slice(0, 3)}${'*'.repeat(localPart.length - 5)}${localPart.slice(-2)}@${domain}`;
}

const Signin = ({ onSuccess, onPasswordChanged, magicLinkToken, passwordResetToken, showLogo = true }: { onSuccess?: () => void; onPasswordChanged?: () => void; magicLinkToken?: string | null; passwordResetToken?: string | null; showLogo?: boolean }) => {
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
  const [selectedResetToken, setSelectedResetToken] = useState<string | null>(null);
  const [firstLoginStep, setFirstLoginStep] = useState<FirstLoginStep | null>(null);
  const [firstLoginSetupToken, setFirstLoginSetupToken] = useState<string | null>(null);
  const [firstLoginEmailHint, setFirstLoginEmailHint] = useState('');
  const [firstLoginPassword, setFirstLoginPassword] = useState('');
  const [firstLoginCode, setFirstLoginCode] = useState('');
  const [firstLoginCodeVerified, setFirstLoginCodeVerified] = useState(false);
  const [passwordSetupCompleted, setPasswordSetupCompleted] = useState(false);

  const { login, selectLoginAccount, refreshUser, setAuthenticatedUser } = useAuth();

  useEffect(() => {
    if (!magicLinkToken) {
      setTokenValid(null);
      return;
    }

    let cancelled = false;
    setTokenValid(null);
    setAccountSelection(null);
    setSelectedAccountId(null);
    setSelectedResetToken(null);
    setFormError('');
    authApi.confirmResetToken(magicLinkToken)
      .then((confirmation) => {
        if (cancelled) return;
        if ('requires_account_selection' in confirmation) {
          setAccountSelection(confirmation);
          setSelectedAccountId(confirmation.accounts[0]?.id ?? null);
        } else {
          setTokenValid(true);
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setTokenValid(false);
        setFormError(error instanceof Error ? error.message : 'This password-change link is invalid or already used.');
      });

    return () => {
      cancelled = true;
    };
  }, [magicLinkToken]);

  useEffect(() => {
    if (!passwordResetToken) {
      setResetTokenValid(null);
      setAccountSelection(null);
      setSelectedAccountId(null);
      setSelectedResetToken(null);
      return;
    }

    let cancelled = false;
    setResetTokenValid(null);
    setAccountSelection(null);
    setSelectedAccountId(null);
    setSelectedResetToken(null);
    setFormError('');
    authApi.confirmResetToken(passwordResetToken)
      .then((confirmation) => {
        if (cancelled) return;
        if ('requires_account_selection' in confirmation) {
          setAccountSelection(confirmation);
          setSelectedAccountId(confirmation.accounts[0]?.id ?? null);
        } else {
          setResetTokenValid(true);
        }
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
        if ('requires_password_setup' in result) {
          setFirstLoginSetupToken(result.setup_token);
          setFirstLoginEmailHint(result.email_hint);
          setFirstLoginPassword(password);
          setFirstLoginCode('');
          setFirstLoginCodeVerified(false);
          setFirstLoginStep('confirm-password');
        } else {
          setAccountSelection(result);
          setSelectedAccountId(result.accounts[0]?.id ?? null);
        }
        return;
      }
      setFormError('');
      onSuccess?.();
    } catch (err: any) {
      const msg = typeof err?.message === 'string' && err.message.trim()
        ? err.message
        : 'Login failed.';
      console.error('[Signin.loginUser] error', msg, err);
      setFormError(msg);
    } finally {
      setLoading(false);
    }
  };

  const continueWithSelectedAccount = async () => {
    if (!accountSelection || selectedAccountId === null) return;
    setLoading(true);
    setFormError('');
    try {
      if (passwordResetToken || magicLinkToken) {
        const selection = await authApi.selectPasswordResetAccount(
          accountSelection.selection_token,
          selectedAccountId,
        );
        setSelectedResetToken(selection.reset_token);
        setAccountSelection(null);
        setSelectedAccountId(null);
        setResetTokenValid(true);
        setTokenValid(true);
        setNewPassword('');
        setConfirmPassword('');
        return;
      }

      await selectLoginAccount(accountSelection.selection_token, selectedAccountId);
      setAccountSelection(null);
      setPasswordSetupCompleted(false);
      onSuccess?.();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to select this account.';
      setFormError(message);
      if (!passwordResetToken && !magicLinkToken) {
        setAccountSelection(null);
        setSelectedAccountId(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyFirstLoginCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstLoginSetupToken) return;
    setLoading(true);
    setFormError('');
    try {
      if (!firstLoginCodeVerified) {
        await authApi.verifyFirstLoginPasswordCode(firstLoginSetupToken, firstLoginCode);
        setFirstLoginCodeVerified(true);
      }
      await completeFirstLoginPassword();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to verify your email or save your password.');
    } finally {
      setLoading(false);
    }
  };

  const confirmFirstLoginPassword = () => {
    setFormError('');
    setFirstLoginStep('verify-code');
  };

  const completeFirstLoginPassword = async () => {
    if (!firstLoginSetupToken || !firstLoginPassword) {
      throw new Error('Please restart sign-in and enter the password you want to use.');
    }
    const result = await authApi.completeFirstLoginPasswordSetup(
      firstLoginSetupToken,
      firstLoginPassword,
    );
    setFirstLoginStep(null);
    setFirstLoginSetupToken(null);
    setFirstLoginEmailHint('');
    setFirstLoginPassword('');
    setFirstLoginCode('');
    setFirstLoginCodeVerified(false);
    setPasswordSetupCompleted(true);
    if ('requires_account_selection' in result) {
      setAccountSelection(result);
      setSelectedAccountId(result.accounts[0]?.id ?? null);
    } else {
      if (result.user) setAuthenticatedUser(result.user);
      else await refreshUser();
      setPasswordSetupCompleted(false);
      onSuccess?.();
    }
  };

  const backToSignIn = () => {
    setFirstLoginStep(null);
    setFirstLoginSetupToken(null);
    setFirstLoginEmailHint('');
    setFirstLoginPassword('');
    setFirstLoginCode('');
    setFirstLoginCodeVerified(false);
    setFormError('');
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
        await authApi.resetPassword(selectedResetToken ?? passwordResetToken, newPassword, confirmPassword);
        setSelectedResetToken(null);
        setResetTokenValid(null);
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
        await authApi.resetPassword(selectedResetToken ?? magicLinkToken, newPassword, confirmPassword);
        setSelectedResetToken(null);
        setTokenValid(null);
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
    <div
      className={firstLoginStep
        ? 'fixed inset-0 z-50 flex min-h-dvh items-center justify-center overflow-y-auto bg-darkmode px-5 py-8'
        : ''}
    >
      <div className={firstLoginStep ? 'w-full max-w-md' : ''}>
      {showLogo && (
        <div className="mb-10 text-center mx-auto inline-block max-w-[160px]">
          <Logo />
        </div>
      )}

      <h2 className="text-center text-2xl font-bold text-white mb-6">
        {accountSelection
          ? 'Choose account'
          : firstLoginStep === 'verify-code'
            ? 'Verify your email'
            : firstLoginStep === 'confirm-password'
              ? 'Use this as your password?'
              : magicLinkToken || passwordResetToken
                ? 'Change Password'
                : isForgotPassword
                  ? 'Forgot Password'
                  : 'Sign In'}
      </h2>

      {passwordResetToken && resetTokenValid === null && !accountSelection && !formError && (
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
      {accountSelection ? (
        <div>
          <p className="mb-5 text-sm text-muted text-center">
            {passwordSetupCompleted
              ? 'Your new password is saved for these linked accounts. Choose which account to open.'
              : passwordResetToken
                ? 'Choose which Crypgo account to reset the password for.'
                : 'Choose which Crypgo account to open.'}
          </p>
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
            {loading
              ? (passwordResetToken ? 'Preparing password reset...' : 'Opening account...')
              : 'Continue'}
          </button>
          {!passwordResetToken && (
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
          )}
        </div>
      ) : firstLoginStep === 'verify-code' ? (
        <div>
          <p className="mb-5 text-sm text-body-secondary text-center">
            We sent a six-digit verification code to <span className="text-white">{maskAccountEmail(firstLoginEmailHint)}</span>. It expires in 15 minutes.
          </p>
          <form onSubmit={verifyFirstLoginCode}>
            <input
              name="first-login-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="6-digit code"
              value={firstLoginCode}
              onChange={(event) => setFirstLoginCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              className="mb-[22px] w-full rounded-md border border-dark_border border-opacity-60 border-solid bg-transparent px-5 py-3 text-center text-lg tracking-[0.35em] text-white outline-none transition placeholder:text-grey focus:border-primary"
            />
            {formError && <p className="mb-4 text-sm text-red-400" role="alert">{formError}</p>}
            <button
              type="submit"
              disabled={loading || firstLoginCode.length !== 6}
              className="mb-3 w-full rounded-lg border border-primary bg-primary py-3 text-18 font-medium text-darkmode hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
          </form>
          <button
            type="button"
            onClick={backToSignIn}
            className="w-full bg-transparent py-2 text-white hover:text-primary"
          >
            Back to sign in
          </button>
        </div>
      ) : firstLoginStep === 'confirm-password' ? (
        <div>
          <p className="mb-5 text-sm text-body-secondary text-center">
            Your Crypgo password was reset and you are asked to set a new one. You can change it later.
          </p>
          {formError && <p className="mb-4 text-sm text-red-400" role="alert">{formError}</p>}
          <button
            type="button"
            onClick={confirmFirstLoginPassword}
            disabled={loading || !firstLoginPassword}
            className="mb-3 w-full rounded-lg border border-primary bg-primary py-3 text-18 font-medium text-darkmode hover:bg-transparent hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Saving password...' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={backToSignIn}
            disabled={loading}
            className="w-full bg-transparent py-2 text-white hover:text-primary disabled:opacity-50"
          >
            Back to sign in
          </button>
        </div>
      ) : ((passwordResetToken && resetTokenValid === true) || (magicLinkToken && tokenValid === true)) ? (
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

      {!firstLoginStep && !accountSelection && (
        <button
          type="button"
          onClick={() => {
            setIsForgotPassword((current) => !current);
            setRequestSent(false);
            setFormError('');
          }}
          className="mx-auto mb-2 block border-none bg-transparent text-center text-base text-white hover:text-primary"
        >
          {isForgotPassword ? 'Back to Password Sign In' : 'Forgot Password?'}
        </button>
      )}

      <p className="text-body-secondary text-center text-white text-base">
        Not a member yet?{" "}
        <Link href="/auth/sign-up" className="text-primary hover:underline">
          Sign Up
        </Link>
      </p>
      </div>
    </div>
  );
};

export default Signin;