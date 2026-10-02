function isHex(v: string) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);
}

export function StylePresetPicker({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string | undefined; onChange: (v: string) => void }) {
  const colorMode = options.every(isHex);
  return (
    <div>
      <div className="mb-2 text-[11px] font-semibold tracking-wide text-white/45">{label.toUpperCase()}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) =>
          colorMode ? (
            <button
              key={opt}
              type="button"
              aria-label={opt}
              onClick={() => onChange(opt)}
              className={`h-9 w-9 rounded-full border-2 ${value === opt ? 'border-white' : 'border-white/20'}`}
              style={{ backgroundColor: opt }}
            />
          ) : (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-xl px-3.5 py-2 text-[12.5px] font-semibold ${
                value === opt
                  ? 'border border-accent-cyan/50 bg-accent-cyan/15 text-accent-cyanSoft'
                  : 'border border-white/10 bg-white/[0.05] text-white/60'
              }`}
            >
              {opt}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
