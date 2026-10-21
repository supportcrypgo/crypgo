'use client';

import React from 'react';
import { Check, ChevronDown, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  cardApplicationsApi,
  cardDeliveryAddressApi,
  type CardDeliveryAddress,
} from '@/data/api';
import { useCardDeliveryAddress } from '@/app/dashboard/components/CardDeliveryAddressProvider';
import MobileHeader from '@/app/dashboard/components/MobileHeader';
import BottomNav from '@/app/dashboard/components/BottomNav';
import DesktopSidebar, { SIDEBAR_OFFSET_CLASS } from '@/app/dashboard/components/DesktopSidebar';
import DesktopHeader from '@/app/dashboard/components/DesktopHeader';

const inputClassName =
  'mt-2 h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white placeholder:text-charcoalGray/80 outline-none transition focus:border-primary/60 focus:bg-white/[0.055]';

const countryCodes =
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE ES FI FJ FK FO FR GA GB GD GE GF GM GQ GR GS GT GU GW HK HM HN HR HU ID IE IL IN IQ IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VN VU WF WS YE YT ZA ZM ZW'.split(' ');
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
const countries = countryCodes
  .map((code) => ({ code, name: regionNames.of(code) ?? code }))
  .sort((a, b) => a.name.localeCompare(b.name));

export default function CardDeliveryDetailsPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const { markSaved, refresh } = useCardDeliveryAddress();
  const [selectedCountry, setSelectedCountry] = React.useState('');
  const [countryMenuOpen, setCountryMenuOpen] = React.useState(false);
  const [isLoadingAddress, setIsLoadingAddress] = React.useState(true);
  const [isSavingAddress, setIsSavingAddress] = React.useState(false);
  const [isDeletingApplication, setIsDeletingApplication] = React.useState(false);
  const [deleteApplicationError, setDeleteApplicationError] = React.useState<string | null>(null);
  const [addressError, setAddressError] = React.useState<string | null>(null);
  const [applicationId, setApplicationId] = React.useState<number | null>(null);

  const deleteApplication = async () => {
    if (applicationId === null || isDeletingApplication) return;
    const confirmed = window.confirm(
      'Delete this incomplete card application? This cannot be undone.',
    );
    if (!confirmed) return;

    setIsDeletingApplication(true);
    setDeleteApplicationError(null);
    try {
      await cardApplicationsApi.delete(applicationId);
      await refresh();
      router.replace('/dashboard/cards');
    } catch (error) {
      setDeleteApplicationError(
        error instanceof Error ? error.message : 'Could not delete your card application.',
      );
      setIsDeletingApplication(false);
    }
  };

  React.useEffect(() => {
    document.documentElement.classList.add('page-scrollbar-hide');
    document.body.classList.add('page-scrollbar-hide');

    let isMounted = true;
    const loadApplicationAddress = async () => {
      try {
        const requestedId = new URLSearchParams(window.location.search).get('application_id');
        let resolvedId: number;
        if (requestedId !== null) {
          resolvedId = Number(requestedId);
          if (!Number.isSafeInteger(resolvedId) || resolvedId <= 0) {
            throw new Error('This card application link is invalid.');
          }
        } else {
          const { applications } = await cardApplicationsApi.list();
          const drafts = applications.filter((application) => application.status === 'draft');
          if (drafts.length !== 1) {
            throw new Error('Choose a card application before entering a delivery address.');
          }
          resolvedId = drafts[0].id;
        }
        if (!isMounted) return;
        setApplicationId(resolvedId);
        const { address } = await cardDeliveryAddressApi.get(resolvedId);
        if (!isMounted || !address || !formRef.current) return;
        const formValues: Record<string, string> = {
          secondaryUnit: address.secondary_unit,
          streetAddress: address.street_address,
          city: address.city,
          state: address.state,
          zipCode: address.zip_code,
        };
        for (const [name, value] of Object.entries(formValues)) {
          const field = formRef.current.elements.namedItem(name);
          if (field instanceof HTMLInputElement) {
            field.value = value;
          }
        }
        setSelectedCountry(address.country);
      } catch (error: unknown) {
        if (isMounted) {
          setAddressError(
            error instanceof Error
              ? error.message
              : 'Could not load your saved delivery address.',
          );
        }
      } finally {
        if (isMounted) setIsLoadingAddress(false);
      }
    };
    void loadApplicationAddress();

    return () => {
      isMounted = false;
      document.documentElement.classList.remove('page-scrollbar-hide');
      document.body.classList.remove('page-scrollbar-hide');
    };
  }, []);

  const content = (
    <main className="mx-auto w-full max-w-[760px] px-5 pb-28 pt-5 text-white sm:px-8 sm:pb-12 sm:pt-8">
      <section>
        <h2 className="text-base font-semibold text-white">Delivery Address</h2>
        <p className="mt-1.5 text-sm text-charcoalGray">Use physical address, no P. O. Box.</p>

        <form
          ref={formRef}
          className="mt-6"
          onSubmit={async (event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            const address: CardDeliveryAddress = {
              secondary_unit: String(formData.get('secondaryUnit') ?? ''),
              street_address: String(formData.get('streetAddress') ?? ''),
              city: String(formData.get('city') ?? ''),
              state: String(formData.get('state') ?? ''),
              zip_code: String(formData.get('zipCode') ?? ''),
              country: selectedCountry,
            };
            setAddressError(null);
            setIsSavingAddress(true);
            try {
              if (applicationId === null) {
                throw new Error('The card application is not ready yet. Please try again.');
              }
              await cardDeliveryAddressApi.save(address, applicationId);
              markSaved();
              router.push(`/dashboard/cards/apply?application_id=${applicationId}`);
            } catch (error) {
              setAddressError(
                error instanceof Error
                  ? error.message
                  : 'Could not save your delivery address. Please try again.',
              );
            } finally {
              setIsSavingAddress(false);
            }
          }}
        >
        <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2">
          <label className="text-sm font-medium text-white sm:col-span-2">
            Secondary Unit
            <input className={inputClassName} type="text" name="secondaryUnit" autoComplete="address-line2" />
          </label>
          <label className="text-sm font-medium text-white sm:col-span-2">
            Street Address
            <input className={inputClassName} type="text" name="streetAddress" autoComplete="street-address" required />
          </label>
          <label className="text-sm font-medium text-white">
            City
            <input className={inputClassName} type="text" name="city" autoComplete="address-level2" required />
          </label>
          <label className="text-sm font-medium text-white">
            State
            <input className={inputClassName} type="text" name="state" autoComplete="address-level1" required />
          </label>
          <label className="text-sm font-medium text-white sm:col-span-2">
            ZIP Code
            <input
              className={inputClassName}
              type="text"
              name="zipCode"
              autoComplete="postal-code"
              inputMode="numeric"
              required
            />
          </label>
          <div
            className="text-sm font-medium text-white sm:col-span-2"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                setCountryMenuOpen(false);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setCountryMenuOpen(false);
            }}
          >
            Country
            <input type="hidden" name="country" value={selectedCountry} />
            <button
              type="button"
              className={`${inputClassName} flex items-center justify-between text-left`}
              aria-haspopup="listbox"
              aria-expanded={countryMenuOpen}
              onClick={() => setCountryMenuOpen((open) => !open)}
            >
              <span className={selectedCountry ? 'text-white' : 'text-charcoalGray/80'}>
                {countries.find(({ code }) => code === selectedCountry)?.name ?? 'Select a country'}
              </span>
              <ChevronDown
                aria-hidden="true"
                className={`h-4 w-4 text-charcoalGray transition-transform ${countryMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows,margin] duration-200 ease-out ${
                countryMenuOpen ? 'mt-2 grid-rows-[1fr]' : 'mt-0 grid-rows-[0fr]'
              }`}
              aria-hidden={!countryMenuOpen}
            >
              <div className="min-h-0">
                {countryMenuOpen && (
                  <div
                    role="listbox"
                    aria-label="Country"
                    className="max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#101827] p-1.5 shadow-xl shadow-black/30 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {countries.map(({ code, name }) => (
                      <button
                        key={code}
                        type="button"
                        role="option"
                        aria-selected={selectedCountry === code}
                        className="flex min-h-10 w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-white/85 transition hover:bg-white/[0.07] hover:text-white focus:bg-white/[0.07] focus:outline-none"
                        onClick={() => {
                          setSelectedCountry(code);
                          setCountryMenuOpen(false);
                        }}
                      >
                        {name}
                        {selectedCountry === code && <Check aria-hidden="true" className="h-4 w-4 text-primary" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {addressError && (
          <p role="alert" className="mt-4 text-sm leading-relaxed text-red-300">
            {addressError}
          </p>
        )}
        <button
          type="submit"
          disabled={isLoadingAddress || isSavingAddress || !selectedCountry}
          className="mt-7 flex h-12 w-full items-center justify-center rounded-xl bg-primary px-5 text-base font-medium text-darkmode transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-darkmode disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[190px]"
        >
          Save &amp; Continue
        </button>
        </form>
        {deleteApplicationError && (
          <p role="alert" className="mt-3 text-sm text-red-300">
            {deleteApplicationError}
          </p>
        )}
        <button
          type="button"
          onClick={() => void deleteApplication()}
          disabled={applicationId === null || isLoadingAddress || isDeletingApplication}
          className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/25 px-5 text-sm font-medium text-red-300 transition hover:border-red-400/50 hover:bg-red-400/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[190px]"
        >
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          {isDeletingApplication ? 'Deleting application…' : 'Delete application'}
        </button>
      </section>
    </main>
  );

  if (isDesktop) {
    return (
      <div className="min-h-screen bg-darkmode text-white">
        <DesktopSidebar />
        <div className={SIDEBAR_OFFSET_CLASS}>
          <DesktopHeader
            title="Card delivery details"
            backHref={`/dashboard/cards/apply?application_id=${applicationId ?? ''}`}
            backLabel="Back to card application"
          />
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-darkmode text-white">
      <MobileHeader
        title="Card delivery details"
        onMenuClick={() => undefined}
        showMenuButton={false}
        showBackButton
        backHref={`/dashboard/cards/apply?application_id=${applicationId ?? ''}`}
        backLabel="Back to card application"
      />
      {content}
      <BottomNav activeTab="cards" />
    </div>
  );
}
