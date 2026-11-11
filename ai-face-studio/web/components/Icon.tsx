import type { ReactNode } from 'react';

export type IconName =
  | 'arrow-left' | 'search' | 'lock' | 'unlock' | 'sparkle' | 'home' | 'grid' | 'folder' | 'user'
  | 'upload' | 'camera' | 'image' | 'trash' | 'check' | 'x' | 'chevron-right' | 'play' | 'download'
  | 'share' | 'sliders' | 'shield' | 'users' | 'cpu' | 'database' | 'alert' | 'dollar' | 'bar-chart'
  | 'star' | 'face' | 'hair' | 'clothing' | 'body' | 'character' | 'photo' | 'video' | 'restore'
  | 'analysis' | 'plus' | 'refresh' | 'pause' | 'pencil';

const PATHS: Record<IconName, ReactNode> = {
  'arrow-left': <path d="M15 18l-6-6 6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  lock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></>,
  unlock: <><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 017.5-2" /></>,
  sparkle: <path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.9L12 3z" />,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  folder: <path d="M4 19V5a2 2 0 012-2h9l5 5v11a2 2 0 01-2 2H6a2 2 0 01-2-2z" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6" /></>,
  upload: <><path d="M12 16V4" /><path d="M6 10l6-6 6 6" /><path d="M4 20h16" /></>,
  camera: <><path d="M4 8h3l2-2h6l2 2h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" /><circle cx="12" cy="13" r="3.4" /></>,
  image: <><rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="M21 15l-5-4-4 3-3-2-6 5" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 13h10l1-13" /></>,
  check: <path d="M5 13l4 4L19 7" />,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  'chevron-right': <path d="M9 18l6-6-6-6" />,
  play: <path d="M8 5l12 7-12 7V5z" />,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
  share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 10.6l6.8-3.8M8.6 13.4l6.8 3.8" /></>,
  sliders: <><path d="M4 6h10M18 6h2" /><path d="M4 12h2M10 12h10" /><path d="M4 18h14M22 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="8" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  shield: <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />,
  users: <><circle cx="9" cy="8" r="3" /><path d="M2 20c0-3 3-5 7-5s7 2 7 5" /><circle cx="18" cy="8" r="2.4" /></>,
  cpu: <><rect x="7" y="7" width="10" height="10" rx="1.5" /><path d="M4 9h3M4 15h3M17 9h3M17 15h3M9 4v3M15 4v3M9 17v3M15 17v3" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" /></>,
  alert: <><path d="M10.3 3.9L2.5 17a1.8 1.8 0 001.5 2.7h16a1.8 1.8 0 001.5-2.7L13.7 3.9a1.8 1.8 0 00-3.4 0z" /><path d="M12 9v4M12 17h.01" /></>,
  dollar: <><circle cx="12" cy="12" r="9" /><path d="M9 15.5c0 1 1.1 1.8 3 1.8s3-.7 3-1.8-1.3-1.6-3-2-3-1-3-2 1.1-1.8 3-1.8 3 .7 3 1.6" /></>,
  'bar-chart': <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
  star: <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />,
  face: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-3.9 3.6-6 8-6s8 2.1 8 6" /></>,
  hair: <><path d="M6 20c1-5 2-7 6-7s5 2 6 7" /><path d="M9 7c0-2 1-4 3-4s3 2 3 4-1 3-3 3-3-1-3-3z" /></>,
  clothing: <path d="M6 7l6-3 6 3v4c0 6-3 9-6 10-3-1-6-4-6-10V7z" />,
  body: <><circle cx="12" cy="6" r="3" /><path d="M8 21v-6a4 4 0 014-4 4 4 0 014 4v6" /></>,
  character: <path d="M12 2l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" />,
  photo: <><rect x="3" y="4" width="18" height="14" rx="2" /><circle cx="8.5" cy="10" r="1.6" /><path d="M21 15l-5-4-4 3-3-2-6 5" /></>,
  video: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M10 9l5 3-5 3V9z" /></>,
  restore: <><path d="M4 14a4 4 0 004 4h8a4 4 0 004-4V8a4 4 0 00-4-4H8a4 4 0 00-4 4v6z" /><path d="M9 12l2 2 4-4" /></>,
  analysis: <><path d="M3 3v18h18" /><path d="M7 15l4-5 3 3 5-7" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: <><path d="M3 12a9 9 0 0115-6.7L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 01-15 6.7L3 16" /><path d="M3 21v-5h5" /></>,
  pause: <><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z" /></>,
};

export function Icon({ name, size = 18, className, strokeWidth = 2 }: { name: IconName; size?: number; className?: string; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
