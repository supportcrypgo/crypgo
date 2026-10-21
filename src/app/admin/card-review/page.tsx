'use client';

import React from 'react';
import { Check, ChevronLeft, ChevronRight, LogOut, RefreshCw } from 'lucide-react';

import {
  ApiRequestError,
  cardReviewApi,
  type CardReviewApplication,
} from '@/data/api';
import { FlippableCreditCard } from '@/components/ui/credit-debit-card';

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function getAddressLines(address: CardReviewApplication['address']): string[] {
  if (!address) return [];
  const country = address.country
    ? new Intl.DisplayNames(['en'], { type: 'region' }).of(address.country) ?? address.country
    : '';
  return [
    [address.secondary_unit, address.street_address].filter(Boolean).join(', '),
    [address.city, address.state, address.zip_code].filter(Boolean).join(', '),
    country,
  ].filter(Boolean);
}

export default function CardReviewPage() {
  const [code, setCode] = React.useState('');
  const [token, setToken] = React.useState<string | null>(null);
  const [applications, setApplications] = React.useState<CardReviewApplication[]>([]);
  const [applicationCount, setApplicationCount] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageCount, setPageCount] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [isInitializing, setIsInitializing] = React.useState(true);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = React.useState(false);
  const [approvingId, setApprovingId] = React.useState<number | null>(null);

  const loadApplications = React.useCallback(async (accessToken: string, page = 1) => {
    setIsLoadingApplications(true);
    const response = await cardReviewApi.list(accessToken, page);
    setApplications(response.applications);
    setApplicationCount(response.count);
    setCurrentPage(response.page);
    setPageCount(response.page_count);
    setIsLoadingApplications(false);
  }, []);

  React.useEffect(() => {
    const storedToken = cardReviewApi.getToken();
    if (!storedToken) {
      setIsInitializing(false);
      return;
    }
    void loadApplications(storedToken)
      .then(() => setToken(storedToken))
      .catch((loadError: unknown) => {
        cardReviewApi.clearToken();
        if (!(loadError instanceof ApiRequestError && loadError.status === 401)) {
          setError(loadError instanceof Error
            ? loadError.message
            : 'Could not load canceled applications.');
        }
      })
      .finally(() => {
        setIsLoadingApplications(false);
        setIsInitializing(false);
      });
  }, [loadApplications]);

  const signIn = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting || !code) return;

    setIsSubmitting(true);
    setError(null);
    try {
      const accessToken = await cardReviewApi.login(code);
      await loadApplications(accessToken, 1);
      setToken(accessToken);
      setCode('');
    } catch (loginError) {
      setIsLoadingApplications(false);
      setError(loginError instanceof Error
        ? loginError.message
        : 'Could not verify the access code. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const refresh = async () => {
    if (!token) return;
    setError(null);
    try {
      await loadApplications(token, currentPage);
    } catch (refreshError) {
      setIsLoadingApplications(false);
      setError(refreshError instanceof Error
        ? refreshError.message
        : 'Could not load canceled applications.');
      if (refreshError instanceof ApiRequestError && refreshError.status === 401) {
        setToken(null);
      }
    }
  };

  const approve = async (application: CardReviewApplication) => {
    if (!token || approvingId !== null) return;
    const name = [application.first_name, application.last_name].filter(Boolean).join(' ')
      || application.email;
    if (!window.confirm(`Approve the canceled card application for ${name}? An approval email will be sent.`)) {
      return;
    }

    setApprovingId(application.id);
    setError(null);
    try {
      await cardReviewApi.approve(token, application.id);
      const nextPage = applications.length === 1 && currentPage > 1
        ? currentPage - 1
        : currentPage;
      await loadApplications(token, nextPage);
    } catch (approvalError) {
      setIsLoadingApplications(false);
      setError(approvalError instanceof Error
        ? approvalError.message
        : 'Could not approve this card application.');
      if (approvalError instanceof ApiRequestError && approvalError.status === 401) {
        setToken(null);
      }
    } finally {
      setApprovingId(null);
    }
  };

  const signOut = () => {
    cardReviewApi.clearToken();
    setToken(null);
    setApplications([]);
    setApplicationCount(0);
    setCurrentPage(1);
    setPageCount(0);
    setError(null);
  };

  return (
    <main className="min-h-screen w-full bg-[#070b12] px-4 py-8 text-white sm:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full flex-col">
        {isInitializing ? (
          <div aria-live="polite" aria-busy="true" className="min-h-24" />
        ) : !token ? (
          <section className="mx-auto flex w-full max-w-sm flex-1 items-center justify-center bg-transparent">
            <form onSubmit={signIn} className="w-full space-y-4">
              <label htmlFor="review-code" className="block text-sm font-medium text-white/80">
                Access code
              </label>
              <input
                id="review-code"
                type="password"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                autoComplete="off"
                required
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-primary"
              />
              {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={isSubmitting || !code}
                className="h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-darkmode transition hover:bg-primary/90 disabled:cursor-wait disabled:opacity-60"
              >
                {isSubmitting ? 'Checking…' : 'Continue'}
              </button>
            </form>
          </section>
        ) : (
          <>
            <header className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                  Crypgo Operations
                </p>
                <h1 className="mt-2 hidden text-2xl font-semibold sm:block sm:text-3xl">
                  Card applications
                </h1>
                <p className="mt-2 text-sm text-white/60">
                  {applicationCount} application{applicationCount === 1 ? '' : 's'} awaiting review.
                </p>
              </div>
              <div className="ml-auto flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  aria-label="Refresh applications"
                  title="Refresh applications"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={signOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/70 transition hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            {error && (
              <p role="alert" className="mt-5 rounded-xl border border-red-400/20 bg-red-400/[0.05] p-4 text-sm text-red-300">
                {error}
              </p>
            )}

            <section
              className={applications.length === 0
                ? 'mt-6 flex flex-1 items-center justify-center text-center'
                : 'mt-8'}
              aria-busy={isLoadingApplications}
            >
              {isLoadingApplications ? (
                <p className="py-12 text-center text-sm text-white/55" role="status">
                  Loading applications…
                </p>
              ) : applications.length === 0 ? (
                <p className="text-sm text-white/60">
                  There are no card applications awaiting review.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-x-6 gap-y-12 md:grid-cols-2 lg:grid-cols-3">
                  {applications.map((application) => {
                    const addressLines = getAddressLines(application.address);
                    return (
                      <article
                        key={application.id}
                        className="min-w-0 space-y-5 md:rounded-2xl md:border md:border-white/[0.1] md:p-4 lg:p-5"
                      >
                        <FlippableCreditCard
                          frontOnly
                          cvv="•••"
                          displayDetails={{
                            cardholderName: application.cardholder_name,
                            cardNumber: application.card_number ?? '',
                            expiry: application.expiry,
                          }}
                          className="max-w-none"
                        />

                        <div className="space-y-1">
                          <p className="break-all text-base leading-6 text-white/85">
                            {application.email}
                          </p>
                          <p className="text-sm leading-6 text-white/60">
                            {application.source_asset || 'Asset not specified'}
                            <span className="mx-2" aria-hidden="true">·</span>
                            {application.status === 'activation_pending'
                              ? 'Pending approval'
                              : `Canceled ${formatDate(application.canceled_at)}`}
                          </p>
                        </div>

                        <div>
                          <h2 className="text-base font-semibold text-white">Delivery address</h2>
                          {addressLines.length ? (
                            <address className="mt-2 space-y-1.5 text-base not-italic leading-6 text-white/80">
                              {addressLines.map((line) => <p key={line}>{line}</p>)}
                            </address>
                          ) : (
                            <p className="mt-2 text-base text-white/60">No saved delivery address</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => void approve(application)}
                          disabled={approvingId !== null || isLoadingApplications}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-400 px-4 text-sm font-semibold text-[#06110b] transition hover:bg-emerald-300 disabled:cursor-wait disabled:opacity-60"
                        >
                          <Check className="h-4 w-4" aria-hidden="true" />
                          {approvingId === application.id ? 'Approving…' : 'Approve'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            {pageCount > 1 && (
              <nav
                aria-label="Card application pages"
                className="mt-8 flex items-center justify-between border-t border-white/[0.08] pt-5"
              >
                <button
                  type="button"
                  onClick={() => token && void loadApplications(token, currentPage - 1).catch((loadError: unknown) => {
                    setIsLoadingApplications(false);
                    setError(loadError instanceof Error ? loadError.message : 'Could not load this page.');
                  })}
                  disabled={currentPage <= 1 || isLoadingApplications || approvingId !== null}
                  className="inline-flex h-10 items-center gap-2 text-sm font-medium text-white/75 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  Previous
                </button>
                <span className="text-sm tabular-nums text-white/55">
                  Page {currentPage} of {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() => token && void loadApplications(token, currentPage + 1).catch((loadError: unknown) => {
                    setIsLoadingApplications(false);
                    setError(loadError instanceof Error ? loadError.message : 'Could not load this page.');
                  })}
                  disabled={currentPage >= pageCount || isLoadingApplications || approvingId !== null}
                  className="inline-flex h-10 items-center gap-2 text-sm font-medium text-white/75 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-35"
                >
                  Next
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
}
