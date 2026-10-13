'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { readStoredProfile } from '@/lib/store-context';

// Entry gate (no sign-in): profile details → Essentials → dashboard.
export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const profile = readStoredProfile();
    const basicsDone = Boolean(
      profile?.name && profile?.gender && profile?.age && profile?.height && profile?.weight
    );
    if (!basicsDone) {
      router.replace('/profile-details');
    } else if (!profile?.activityLevel || !profile?.goal) {
      router.replace('/calculator');
    } else {
      router.replace('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}
