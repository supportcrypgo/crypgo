"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import Logo from "@/components/Layout/Header/Logo";
import { useAuth } from '@/hooks/useAuth';
import { authApi } from '@/data/api';
import { useEffect } from 'react';

const Signin = ({ onSuccess, onPasswordChanged, magicLinkToken }: { onSuccess?: () => void; onPasswordChanged?: () => void; magicLinkToken?: string | null }) => {
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const { login } = useAuth();

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

  const loginUser = async (email: string, password: string) => {
    setLoading(true);
    setFormError('');
    try {
      await login(email, password);
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

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    setFormError('');
    if (magicLinkToken) {
      if (newPassword !== confirmPassword) {
        setFormError('Passwords do not match.');
        return;
      }
      setLoading(true);
      try {
        await authApi.resetPasswordWithMagicLink(magicLinkToken, newPassword, confirmPassword);
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
        {magicLinkToken ? 'Change Password' : isForgotPassword ? 'Forgot Password' : 'Sign In'}
      </h2>

      {magicLinkToken && tokenValid === null && !formError && (
        <p className="mb-6 text-sm text-body-secondary" role="status">Validating your password-change link...</p>
      )}
      {magicLinkToken && tokenValid === false && (
        <p className="mb-6 text-sm text-red-400" role="alert">{formError}</p>
      )}
      {magicLinkToken && tokenValid === true ? (
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
      ) : !magicLinkToken ? <form onSubmit={handleSubmit}>
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
        <Link href="/signup" className="text-primary hover:underline">
          Sign Up
        </Link>
      </p>
    </>
  );
};

export default Signin;