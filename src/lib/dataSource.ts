export const API_AVAILABLE = process.env.NEXT_PUBLIC_API_AVAILABLE === 'true';
export const USE_FIXTURES =
  process.env.NODE_ENV === 'development' &&
  !API_AVAILABLE &&
  process.env.NEXT_PUBLIC_USE_FIXTURES === 'true';

export function shouldUseFixtures(): boolean {
  return USE_FIXTURES;
}
