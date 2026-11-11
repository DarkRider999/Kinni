import type { LockKey, Locks } from '../lib/types';
import { Icon } from './Icon';

const LABELS: Record<LockKey, string> = {
  face: 'Face', hair: 'Hair', body: 'Body', clothing: 'Clothing', background: 'Background', skin: 'Skin',
};

const ORDER: LockKey[] = ['face', 'hair', 'body', 'clothing', 'background', 'skin'];

export function SmartEditLocks({ locks, onChange }: { locks: Locks; onChange: (locks: Locks) => void }) {
  const active = ORDER.filter((key) => locks[key]);
  if (active.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-white/45">SMART EDIT LOCKS</div>
      <div className="flex flex-wrap gap-2">
        {active.map((key) => {
          const state = locks[key];
          const isChange = state === 'change';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ ...locks, [key]: isChange ? 'lock' : 'change' })}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-semibold ${
                isChange
                  ? 'border border-accent-purple/50 bg-accent-purple/20 text-[#E9E1FF]'
                  : 'border border-white/10 bg-white/[0.05] text-white/60'
              }`}
            >
              <Icon name={isChange ? 'sparkle' : 'lock'} size={13} />
              {LABELS[key]} · {isChange ? 'Change' : 'Lock'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
