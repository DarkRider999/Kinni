import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { Icon } from './Icon';

export function TopBar({ title, onBack, right }: { title: string; onBack?: () => void; right?: ReactNode }) {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between px-5 pt-4 pb-2">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack ?? (() => router.back())}
        className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] text-white"
      >
        <Icon name="arrow-left" size={17} />
      </button>
      <h1 className="font-display text-[15px] font-semibold text-white">{title}</h1>
      <div className="flex h-9 min-w-9 items-center justify-end">{right}</div>
    </div>
  );
}
