'use client';

import { Suspense } from 'react';
import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function MagicLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    router.replace(token ? `/?magicToken=${encodeURIComponent(token)}` : '/?signin=1');
  }, [searchParams]);

  return null;
}

export default function MagicLinkPage() {
  return (
    <Suspense fallback={null}>
      <MagicLinkContent />
    </Suspense>
  );
}
