import { Icon } from './Icon';

export function ConsentNotice({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 rounded-xl2 border border-line bg-white/[0.03] p-3.5">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-accent-purple"
      />
      <span className="text-[12px] leading-snug text-white/65">
        <Icon name="shield" size={13} className="mr-1 inline text-accent-cyanSoft" />
        Only upload images you have the right or permission to edit. Generations that would create
        non-consensual, sexual or exploitative content of a real person are blocked automatically.
      </span>
    </label>
  );
}
