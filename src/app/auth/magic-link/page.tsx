'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function MagicLinkRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    router.replace(token ? `/?magicToken=${encodeURIComponent(token)}` : '/?signin=1');
  }, [router, searchParams]);

  return null;
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkRedirect />
    </Suspense>
  );
}
