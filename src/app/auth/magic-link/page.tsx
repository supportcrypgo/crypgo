'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function MagicLinkPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    router.replace(token ? `/?magicToken=${encodeURIComponent(token)}` : '/?signin=1');
  }, [searchParams]);

  return null;
}
