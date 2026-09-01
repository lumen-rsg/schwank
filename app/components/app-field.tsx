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
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  autoComplete?: string;
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
        min={type === 'number' ? 0 : undefined}
        step={type === 'number' ? 'any' : undefined}
        required
      />
    </label>
  );
}
