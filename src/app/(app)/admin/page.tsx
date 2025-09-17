'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to programs page by default
    router.push('/admin/programs');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-64">
      <p className="text-muted-foreground">Redirecting to admin panel...</p>
    </div>
  );
}