export function LabeledSlider({
  label, value, onChange, suffix = '%',
}: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-white/45">{label.toUpperCase()}</span>
        <span className="text-[13px] font-bold text-accent-purpleSoft">{value}{suffix}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-accent-purple"
        style={{
          background: `linear-gradient(90deg, #8B5CF6 0%, #22D3EE ${value}%, rgba(255,255,255,0.1) ${value}%)`,
        }}
        aria-label={label}
      />
    </div>
  );
}
