'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { IUserPublic, UserRole } from '@ananvi/shared';

const NAV_ITEMS = [
  { href: '/studio',    label: 'Studio',    icon: '🎬' },
  { href: '/clips',     label: 'My Clips',  icon: '🎞️' },
  { href: '/billing',   label: 'Credits',   icon: '💰' },
  { href: '/analytics', label: 'Analytics', icon: '📊' },
  { href: '/settings',  label: 'Settings',  icon: '⚙️' },
];

const ADMIN_ITEMS = [
  { href: '/admin',          label: 'Dashboard',  icon: '📈' },
  { href: '/admin/users',    label: 'Users',      icon: '👥' },
  { href: '/admin/jobs',     label: 'Jobs',       icon: '🔄' },
  { href: '/admin/billing',  label: 'Billing',    icon: '💳' },
  { href: '/admin/audit',    label: 'Audit Log',  icon: '📋' },
  { href: '/admin/settings', label: 'Settings',   icon: '🔧' },
];

interface Props {
  user: IUserPublic | null;
  isAdmin?: boolean;
}

export default function Sidebar({ user, isAdmin }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();

  const items = isAdmin ? ADMIN_ITEMS : NAV_ITEMS;
  const hasAdminRole = user?.roles?.some(r =>
    [UserRole.SUPER_ADMIN, UserRole.ADMIN].includes(r as UserRole)
  );

  return (
    <aside className="w-64 bg-[#111] border-r border-[#2a2a2a] flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-6 border-b border-[#2a2a2a]">
        <Link href="/studio" className="text-xl font-bold text-[#f5c518]">
          Ananvi Studio
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-4 space-y-1">
        {items.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
              transition-colors ${
              pathname === item.href
                ? 'bg-[#f5c518]/10 text-[#f5c518]'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
            }`}
          >
            <span>{item.icon}</span>
            {item.label}
          </Link>
        ))}

        {/* Admin toggle */}
        {hasAdminRole && !isAdmin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                       text-gray-400 hover:text-white hover:bg-[#1a1a1a] mt-4 border-t
                       border-[#2a2a2a] pt-4"
          >
            🛡️ Admin Panel
          </Link>
        )}

        {isAdmin && (
          <Link
            href="/studio"
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                       text-gray-400 hover:text-white hover:bg-[#1a1a1a] mt-4 border-t
                       border-[#2a2a2a] pt-4"
          >
            ← Back to Studio
          </Link>
        )}
      </nav>

      {/* User card + logout */}
      <div className="p-4 border-t border-[#2a2a2a]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-[#f5c518]/20 flex items-center
                          justify-center text-sm font-bold text-[#f5c518]">
            {(user?.display_name || user?.username || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {user?.display_name || user?.username}
            </p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => { logout(); router.push('/login'); }}
          className="w-full text-sm text-gray-400 hover:text-red-400 text-left transition"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
