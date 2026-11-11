import Link from 'next/link';
import type { ToolDef } from '../lib/types';
import { Icon } from './Icon';

export function ToolCard({ tool }: { tool: ToolDef }) {
  const href = tool.kind === 'generate' ? '/creator' : `/upload/${tool.id}`;
  return (
    <Link
      href={href}
      className={`flex flex-col gap-2.5 rounded-xl2 border p-4 transition ${
        tool.available
          ? 'border-line bg-white/[0.04] hover:bg-white/[0.07]'
          : 'border-white/[0.06] bg-white/[0.02] opacity-70'
      }`}
    >
      <div className="flex items-center justify-between">
        <Icon name={tool.icon as any} size={22} className={tool.available ? 'text-accent-purpleSoft' : 'text-white/30'} />
        {!tool.available && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[9px] font-bold text-white/50">SOON</span>}
      </div>
      <div>
        <div className="text-[13px] font-semibold text-white">{tool.name}</div>
        <div className="mt-0.5 text-[11px] leading-snug text-white/45">{tool.description}</div>
      </div>
    </Link>
  );
}
