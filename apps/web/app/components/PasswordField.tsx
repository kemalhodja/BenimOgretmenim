"use client";

import { useId, useState } from "react";

type PasswordFieldProps = {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  minLength?: number;
  placeholder?: string;
  className?: string;
  label?: string;
  hint?: string;
};

export function PasswordField({
  id,
  name,
  value,
  onChange,
  autoComplete,
  minLength,
  placeholder,
  className,
  label,
  hint,
}: PasswordFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [visible, setVisible] = useState(false);

  return (
    <label className="block" htmlFor={fieldId}>
      {label ? <div className="mb-1 text-sm font-medium text-paper-800">{label}</div> : null}
      <div className="relative">
        <input
          id={fieldId}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={
            className ??
            "w-full rounded-xl border border-paper-200 px-3 py-2 pr-20 text-sm outline-none focus:border-brand-400"
          }
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          minLength={minLength}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto rounded-lg px-2 py-1 text-xs font-semibold text-brand-800 hover:bg-paper-50"
          aria-pressed={visible}
          aria-label={visible ? "Parolayı gizle" : "Parolayı göster"}
        >
          {visible ? "Gizle" : "Göster"}
        </button>
      </div>
      {hint ? <p className="mt-1 text-xs text-paper-800/55">{hint}</p> : null}
    </label>
  );
}
