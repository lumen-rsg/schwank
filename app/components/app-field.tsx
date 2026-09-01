'use client';

export function Field({
  name,
  label,
  type = 'text',
  placeholder,
  defaultValue,
  minLength,
  maxLength,
  autoComplete,
  min,
  max,
  step,
  required = true,
  disabled = false,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="form-field">
      <span>{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        defaultValue={defaultValue}
        minLength={minLength}
        maxLength={maxLength}
        autoComplete={autoComplete}
        min={min ?? (type === 'number' ? 0 : undefined)}
        max={max}
        step={step ?? (type === 'number' ? 'any' : undefined)}
        required={required}
        disabled={disabled}
      />
    </label>
  );
}
