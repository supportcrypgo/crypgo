'use client';

import * as React from 'react';
import Image from 'next/image';
import { cardIssuerApi, type CardIssuerDetails } from '@/data/api';
import { cn, getImagePrefix } from '@/utils/utils';

interface FlippableCreditCardProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  cvv: string;
  frontOnly?: boolean;
  applicationId?: number;
  showCardDetails?: boolean;
  displayDetails?: {
    cardholderName: string;
    cardNumber: string;
    expiry: string;
  };
}

const FlippableCreditCard = React.forwardRef<HTMLButtonElement, FlippableCreditCardProps>(
  ({
    className,
    cvv,
    frontOnly = false,
    applicationId,
    showCardDetails = true,
    displayDetails,
    onClick,
    ...props
  }, ref) => {
    const [flipped, setFlipped] = React.useState(false);
    const [cardIssuer, setCardIssuer] = React.useState<CardIssuerDetails | null>(null);
    const [issuerUnavailable, setIssuerUnavailable] = React.useState(false);

    React.useEffect(() => {
      if (applicationId === undefined || displayDetails !== undefined) return;
      let isMounted = true;
      setIssuerUnavailable(false);
      cardIssuerApi.getDetails(applicationId).then(
        (details) => {
          if (isMounted) setCardIssuer(details);
        },
        () => {
          if (isMounted) {
            setCardIssuer(null);
            setIssuerUnavailable(true);
          }
        },
      );
      return () => {
        isMounted = false;
      };
    }, [applicationId, displayDetails]);

    const cardNumber = displayDetails?.cardNumber ?? cardIssuer?.card_issuer_number ?? '0000000000000000';
    const cardNumberGroups = cardNumber.match(/.{1,4}/g) ?? [];
    const cardholderName = (
      displayDetails?.cardholderName ?? cardIssuer?.cardholder_name ?? 'CRYPGO USER'
    ).toUpperCase();
    const cardExpiry = displayDetails?.expiry ?? cardIssuer?.expiry ?? '00/00';
    const cardFaces = (
      <span
        className={cn(
          'relative block h-full w-full rounded-[22px] shadow-2xl shadow-black/30 [transform-style:preserve-3d] sm:rounded-[28px]',
          !frontOnly && 'transition-transform duration-700 group-hover:[transform:rotateY(180deg)] group-aria-pressed:[transform:rotateY(180deg)] motion-reduce:transition-none'
        )}
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 overflow-hidden rounded-[22px] border border-blue-200/[0.08] bg-[#030916] sm:rounded-[28px]"
        >
          <span
            className="absolute inset-0"
            style={{
              backgroundImage:
                'radial-gradient(ellipse at 88% 4%, rgba(29,57,105,.2), transparent 38%), radial-gradient(ellipse at 8% 100%, rgba(13,34,71,.28), transparent 48%), linear-gradient(135deg, #020611 0%, #09162c 48%, #040b18 100%)',
            }}
          />
          <span className="absolute -right-20 -top-36 h-[440px] w-[440px] rounded-full border border-blue-100/[0.08]" />
          <span className="absolute -right-7 -top-24 h-[340px] w-[340px] rounded-full border border-slate-300/[0.08]" />
          <span className="absolute right-[-42px] -top-12 h-[230px] w-[230px] rounded-full border border-blue-100/[0.07]" />
          <svg
            aria-hidden="true"
            className="absolute right-5 top-5 h-12 w-16 sm:right-7 sm:top-7 sm:h-14 sm:w-20"
            viewBox="0 0 112 80"
            fill="none"
          >
            <path d="M54 16C60 24 60 36 54 44" stroke="white" strokeOpacity="0.82" strokeWidth="1.5" />
            <path d="M66 11C75 23 75 38 66 50" stroke="white" strokeOpacity="0.82" strokeWidth="1.5" />
            <path d="M78 6C90 22 90 41 78 56" stroke="white" strokeOpacity="0.82" strokeWidth="1.5" />
            <path d="M90 1C105 21 105 44 90 62" stroke="white" strokeOpacity="0.82" strokeWidth="1.5" />
          </svg>
        </span>

        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col justify-between overflow-hidden rounded-[22px] border border-white/15 p-5 text-left text-white [backface-visibility:hidden] sm:rounded-[28px] sm:p-7"
        >
          <Image
            src={`${getImagePrefix()}images/logo/logo.png`}
            alt="Crypgo"
            width={120}
            height={40}
            className="absolute left-5 top-5 h-8 w-auto object-contain object-left sm:left-7 sm:top-7 sm:h-10"
          />
          <span className="absolute left-5 top-[46%] -translate-y-1/2 sm:left-7">
            <svg
              className="h-12 w-12 sm:h-14 sm:w-14"
              xmlns="http://www.w3.org/2000/svg"
              x="0px"
              y="0px"
              viewBox="0 0 50 50"
            >
              <image href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAMAAAAp4XiDAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAB6VBMVEUAAACNcTiVeUKVeUOYfEaafEeUeUSYfEWZfEaykleyklaXe0SWekSZZjOYfEWYe0WXfUWXe0WXfUWXe0WcgEicfkiXe0SVekSXekSWekKYe0a9nF67m12ZfUWUeEaXfESVekOdgEmVeUWWekSniU+VeUKVeUOrjFKYfEWliE6WeESZe0GSe0WYfES7ml2Xe0WXeESUeEOWfEWcf0eWfESXe0SXfEWYekSVeUKXfEWxklawkVaZfEWWekOUekOWekSYfESZe0eXekWYfEWZe0WZe0eVeUSWeETAnmDCoWLJpmbxy4P1zoXwyoLIpWbjvXjivnjgu3bfu3beunWvkFWxkle/nmDivXiWekTnwXvkwHrCoWOuj1SXe0TEo2TDo2PlwHratnKZfEbQrWvPrWua fUfbt3PJp2agg0v0zYX0zYSfgkvKp2frxX7mwHrlv3rsxn/yzIPgvHfduXWXe0XuyIDzzISsjVO1lVm0lFitjVPzzIPqxX7duna0lVncuHTLqGjvyIHeuXXxyYGZfUayk1iyk1e2lln1zYTEomO2llrb tnOafkjFpGSbfkfZtXLhvHfkv3nqxH3mwXujhU3KqWizlFilh06khk2fgkqsjlPHpWXJp2erjVOhg0yWe0SliE+XekShhEvAn2D///+gx8TWAAAARnRSTlMACVCTtsRl7Pv7+vxkBab7pZv5+ZlL/UnU/f3SJCVe+Fx39naA9/75XSMh0/3SSkia+pil/KRj7Pr662JPkrbP7OLQ0JFOijI1MwAAAAFiS0dEorDd34wAAAAJcEhZcwAACxMAAAsTAQCanBgAAAAHdElNRQfnAg0IDx2lsiuJAAACLElEQVRIx2NgGAXkAUYmZhZWPICFmYkRVQcbOwenmzse4MbFzc6DpIGXj8PD04sA8PbhF+CFaxEU8iWkAQT8hEVgOkTF/InR4eUVICYO1SIhCRMLDAoKDvFDVhUaEhwUFAjjSUlDdMiEhcOEItzdI6OiYxA6YqODIt3dI2DcuDBZsBY5eVTr4xMSYcyk5BRUOXkFsBZFJTQnp6alQxgZmVloUkrKYC0qqmji2WE5EEZuWB6alKoKdi35YQUQRkFYPpFaCouKIYzi6EDitJSUlsGY5RWVRGjJLyxNy4ZxqtIqqvOxaVELQwZFZdkIJVU1RSiSalAt6rUwUBdWG1CP6pT6gNqwOrgCdQyHNYR5YQFhDXj8MiK1IAeyN6aORiyBjByVTc0FqBoKWpqwRCVSgilOaY2OaUPw29qjOzqLvTAchpos47u6EZyYnngUSRwpuTe6D+6qaFQdOPNLRzOM1dzhRZyW+CZouHk3dWLXglFcFIflQhj9YWjJGlZcaKAVSvjyPrRQ0oQVKDAQHlYFYUwIm4gqExGmBSkutaVQJeomwViTJqPK6OhCy2Q9sQBk8cY0DxjTJw0lAQWK6cOKfgNhpKK7ZMpUeF3jPa28BCETamiEqJKM+X1gxvWXpoUjVIVPnwErw71nmpgiqiQGBjNzbgs3j1nus+fMndc+Cwm0T52/oNR9lsdCS24ra7Tq1cbWjpXV3sHRCb1idXZ0sGdltXNxRateRwHRAACYHutzk/2I5QAAACV0RVh0ZGF0ZTpjcmVhdGUAMjAyMy0wMi0xM1QwODoxNToyOSswMDowMEUnN7UAAAAldEVYdGRhdGU6bW9kaWZ5ADIwMjMtMDItMTNUMDg6MTU6MjkrMDA6MDA0eo8JAAAAKHRFWHRkYXRlOnRpbWVzdGFtcAAyMDIzLTAyLTEzVDA4OjE1OjI5KzAwOjAwY2+u1gAAAABJRU5ErkJggg==" />
            </svg>
          </span>
          {showCardDetails && (
            <>
              <span className="absolute left-5 right-5 top-[calc(46%+33px)] grid grid-cols-4 font-mono text-[clamp(18px,6.4vw,34px)] font-medium tracking-[0.08em] text-white/90 sm:left-7 sm:right-7 sm:top-[calc(46%+39px)] sm:text-[clamp(24px,3.25vw,34px)] sm:tracking-[0.1em]">
                {cardNumberGroups.map((group, index) => (
                  <span key={`${index}-${group}`} className={index === 2 ? 'relative left-1 flex flex-col' : undefined}>
                    {group}
                    {index === 2 && (
                      <span className="mt-1 flex items-start gap-2 font-sans text-[8px] font-medium tracking-[0.18em] text-white/60 sm:text-[9px]">
                        <span className="text-left">
                          <span className="block">VALID</span>
                          <span className="block">THRU</span>
                        </span>
                        <span className="self-center whitespace-nowrap font-mono text-[12px] leading-[24px] tracking-normal text-white/90 sm:text-[13px] sm:leading-[26px]">
                          {cardExpiry}
                        </span>
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <span className="absolute bottom-5 left-5 max-w-[58%] truncate whitespace-nowrap text-[clamp(14px,4vw,18px)] font-medium tracking-wide text-white/85 sm:bottom-7 sm:left-7 sm:text-[clamp(16px,1.8vw,20px)]">
                {cardholderName}
              </span>
            </>
          )}
          <span
            aria-label="Mastercard"
            className="absolute bottom-5 right-5 flex h-[clamp(26px,8cqw,40px)] w-[clamp(42px,13.2cqw,64px)] items-center justify-center max-[379px]:bottom-1 sm:bottom-7 sm:right-7"
          >
            <span className="absolute left-0 h-[clamp(26px,8cqw,40px)] w-[clamp(26px,8cqw,40px)] rounded-full bg-[#eb5b48]/90" />
            <span className="absolute right-0 h-[clamp(26px,8cqw,40px)] w-[clamp(26px,8cqw,40px)] rounded-full bg-[#f4b544]/90" />
            <span className="relative whitespace-nowrap text-[clamp(7px,2.2cqw,10px)] font-semibold tracking-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
              Mastercard
            </span>
          </span>
        </span>

        <span
          aria-hidden="true"
          className="absolute inset-0 flex flex-col overflow-hidden rounded-[22px] border border-white/15 bg-[#10151d] px-[4.7%] pt-[2.5%] text-white [backface-visibility:hidden] [transform:rotateY(180deg)] sm:rounded-[28px]"
        >
          <span className="shrink-0 text-left text-[clamp(6px,1.75cqw,9px)] font-semibold uppercase leading-none tracking-[0.08em] text-white/75">
            USE OF THIS CARD IS SUBJECT TO CARD HOLDER AGREEMENT
          </span>
          <span className="mt-[2%] h-[18%] w-full shrink-0 bg-neutral-950" />
          <span className="mt-[3%] flex h-[17%] shrink-0 items-center justify-between rounded-[3px] bg-neutral-200 px-[4%] text-neutral-900">
            <span className="min-w-0 flex-1 border-r border-neutral-400/70" />
            {showCardDetails && (
              <span className="ml-[3%] flex items-baseline gap-1 font-mono text-[clamp(7px,2cqw,10px)]">
                <span className="text-[0.72em] font-sans font-semibold uppercase tracking-wider text-neutral-600">CVV</span>
                <span>{cvv}</span>
              </span>
            )}
          </span>
          <span className="mt-[2%] flex shrink-0 justify-between gap-2 text-[clamp(6px,2.1cqw,10px)] font-semibold uppercase leading-none tracking-[0.04em] text-white/70">
            <span>AUTHORIZED SIGNATURE</span>
            <span className="text-right">NOT VALID UNLESS SIGNED</span>
          </span>
          <span className="mt-[2.5%] text-left text-[clamp(6px,2.1cqw,10px)] leading-[1.2] text-white/65">
            This card is a property of Crypgo, and is subject to cancellation without notice. By signing and/or using this card the holder agrees to be bound by terms and conditions specified in the Crypgo Platform Agreement and all future ammendments there to.
          </span>
          <span className="mt-[1.5%] flex shrink-0 flex-col items-start gap-[1.5%] pb-[3%] text-left text-[clamp(6px,2.1cqw,10px)] leading-[1.2] text-white/75">
            <span>If found, please call the number below.</span>
            <span className="font-semibold">Customer Service: 1-415-688-8892</span>
          </span>
          <span className="absolute bottom-[3%] left-[4.7%] text-[clamp(6px,1.8cqw,8px)] font-medium tracking-wide text-white/60">
            www.crypgo.us.ci
          </span>
        </span>
      </span>
    );

    const containerClass = cn(
      'block aspect-[1.586/1] w-full max-w-[520px] [container-type:inline-size] [perspective:1000px]',
      !frontOnly && 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-darkmode',
      className
    );

    if (frontOnly) {
      return (
        <>
          <div
            role="img"
            aria-label={showCardDetails
              ? 'Non-functional card issuer number; not for payments'
              : 'Crypgo card preview'}
            className={containerClass}
          >
            {cardFaces}
          </div>
          {issuerUnavailable && (
            <p role="alert" className="mt-2 text-center text-xs text-red-300">
              Could not load this application’s card details.
            </p>
          )}
        </>
      );
    }

    return (
      <button
        type="button"
        ref={ref}
        aria-label={`Non-functional card issuer number, ${flipped ? 'back' : 'front'} side; not for payments. Hover, click, or tap to flip.`}
        aria-pressed={flipped}
        onClick={(event) => {
          setFlipped((previous) => !previous);
          onClick?.(event);
        }}
        className={cn('group', containerClass)}
        {...props}
      >
        {cardFaces}
      </button>
    );
  }
);

FlippableCreditCard.displayName = 'FlippableCreditCard';

export { FlippableCreditCard };
