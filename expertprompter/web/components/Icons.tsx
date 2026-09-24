// Tiny inline icon set (no icon library dependency).
import type { SVGProps } from 'react';

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...props,
});

export const SparklesIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z" /></svg>
);
export const CopyIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
);
export const CheckIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M20 6L9 17l-5-5" /></svg>);
export const RefreshIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M21 12a9 9 0 11-3-6.7L21 8" /><path d="M21 3v5h-5" /></svg>
);
export const SunIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
);
export const MoonIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>);
export const ChevronIcon = (p: SVGProps<SVGSVGElement>) => (<svg {...base(p)}><path d="M6 9l6 6 6-6" /></svg>);
export const ExternalIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><path d="M15 3h6v6M10 14L21 3" /></svg>
);
export const StarIcon = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => (
  <svg {...base(p)} fill={filled ? 'currentColor' : 'none'}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" /></svg>
);
export const TrashIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
);
export const SaveIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" /><path d="M17 21v-8H7v8M7 3v5h8" /></svg>
);
export const DownloadIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" /></svg>
);
export const SpinnerIcon = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)} className={`animate-spin ${p.className ?? ''}`}><path d="M21 12a9 9 0 11-6.2-8.6" /></svg>
);
