const getImagePrefix = () => {
  // Use the app root for standard deployments so image URLs remain absolute
  // and work reliably after redirects from nested routes like /auth/campaign-access.
  return process.env.NEXT_PUBLIC_BASE_PATH === "/Crypgo" ? "/Crypgo/" : "/";
};

export { getImagePrefix };

/** Merge Tailwind class names */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}