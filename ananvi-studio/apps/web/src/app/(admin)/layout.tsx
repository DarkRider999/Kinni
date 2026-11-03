'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import Sidebar from '@/components/layout/Sidebar';
import { UserRole } from '@ananvi/shared';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const roles = user?.roles ?? [];
    if (!roles.includes(UserRole.SUPER_ADMIN) && !roles.includes(UserRole.ADMIN)) {
      router.push('/studio');
    }
  }, [isAuthenticated, user, router]);

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen bg-[#0a0a0a]">
      <Sidebar user={user} isAdmin />
      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        {children}
      </main>
    </div>
  );
}
