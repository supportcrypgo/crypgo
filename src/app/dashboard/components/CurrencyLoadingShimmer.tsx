interface CurrencyLoadingShimmerProps {
  className?: string;
}

export default function CurrencyLoadingShimmer({
  className = '',
}: CurrencyLoadingShimmerProps) {
  return (
    <span
      role="status"
      aria-label="Loading currency value"
      className={`inline-block h-[1em] w-28 animate-pulse rounded bg-white/10 align-middle ${className}`}
    />
  );
}
