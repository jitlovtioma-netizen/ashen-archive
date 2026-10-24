"use client";



// ── Мелкие компоненты формы ─────────────────────────────────────────────────

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <span className="text-[10px] text-dim tracking-widest mb-1 block">
        {`// ${label} //`}
      </span>
      {children}
    </div>
  );
}

export function TextInput({
  value,
  onChange,
  maxLength,
  placeholder,
  className = "",
  list,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength?: number;
  placeholder?: string;
  className?: string;
  list?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      maxLength={maxLength}
      placeholder={placeholder}
      list={list}
      className={`w-full bg-black/40 border border-[var(--line)] focus:border-[var(--amber-dim)] outline-none px-2.5 py-1.5 text-[12px] text-[var(--text)] transition-colors ${className}`}
      style={{ clipPath: "polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)" }}
    />
  );
}
