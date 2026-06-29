'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function LegacyEMagazineEditRedirect() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id || '');

  useEffect(() => {
    if (!id) return;
    router.replace(`/admin/emagazines/${id}`);
  }, [id, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Loader2 className="h-7 w-7 animate-spin text-primary-600" />
    </div>
  );
}
