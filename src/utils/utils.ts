const getImagePrefix = () => {
  // Only use /Crypgo/ prefix when explicitly configured for GitHub Pages
  // Local development and ngrok use the root path
  return process.env.NEXT_PUBLIC_BASE_PATH === "/Crypgo" ? "/Crypgo/" : "";
};

export { getImagePrefix };

/** Merge Tailwind class names */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}