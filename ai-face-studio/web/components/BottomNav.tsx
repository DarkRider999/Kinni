import Link from 'next/link';
import { useRouter } from 'next/router';
import { Icon } from './Icon';

const ITEMS = [
  { href: '/home', label: 'Home', icon: 'home' as const },
  { href: '/creator', label: 'Create', icon: 'sparkle' as const },
  { href: '/tools', label: 'Tools', icon: 'grid' as const },
  { href: '/projects', label: 'Projects', icon: 'folder' as const },
  { href: '/profile', label: 'Profile', icon: 'user' as const },
];

export function BottomNav() {
  const router = useRouter();
  return (
    <nav className="relative flex h-[76px] shrink-0 items-center justify-around border-t border-line bg-ink-950/90 px-2 pb-3 backdrop-blur-xl">
      {ITEMS.map((item) => {
        const active = router.pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${active ? 'text-accent-purpleSoft' : 'text-white/40'}`}
          >
            <Icon name={item.icon} size={20} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
