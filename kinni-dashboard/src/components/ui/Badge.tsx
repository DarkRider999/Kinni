import type { ReactNode } from 'react';
import type { BadgeTone } from '../../types';

interface BadgeProps {
  tone?: BadgeTone;
  dot?: boolean;
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, icon, className = '', children }: BadgeProps) {
  const toneClass = tone === 'neutral' ? '' : ` badge--${tone}`;
  return (
    <span className={`badge${toneClass} ${className}`.trim()}>
      {dot && <span className="badge-dot" />}
      {icon}
      {children}
    </span>
  );
}
