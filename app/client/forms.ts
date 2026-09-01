import type { SubmitEvent } from 'react';
import type { Post } from '../features/types';

const numericFields = new Set([
  'calories',
  'protein',
  'carbs',
  'fat',
  'amount',
  'amountMl',
  'waterGoal',
  'occurrences',
  'cost',
  'heightCm',
  'weightKg',
  'age',
  'remainingAmount',
  'estimatedCost',
  'assigneeId',
]);

export function serializeFormData(
  values: FormData,
  type: string,
  extra: Record<string, string> = {},
) {
  const payload: Record<string, string | number | boolean> = { type, ...extra };
  for (const [key, value] of values.entries()) {
    if (typeof value !== 'string') continue;
    payload[key] = numericFields.has(key) ? Number(value) : value;
  }
  return payload;
}

export async function withFormSubmission(
  event: SubmitEvent<HTMLFormElement>,
  submit: (form: HTMLFormElement) => Promise<boolean>,
) {
  event.preventDefault();
  const form = event.currentTarget;
  if (form.dataset.submitting === 'true' || !form.reportValidity())
    return false;
  const buttons = Array.from(
    form.querySelectorAll<HTMLButtonElement>(
      'button:not([type="button"]), input[type="submit"]',
    ),
  );
  const disabled = buttons.map((button) => button.disabled);
  form.dataset.submitting = 'true';
  form.setAttribute('aria-busy', 'true');
  form.classList.add('is-submitting');
  buttons.forEach((button) => {
    button.disabled = true;
  });
  try {
    return await submit(form);
  } finally {
    delete form.dataset.submitting;
    form.removeAttribute('aria-busy');
    form.classList.remove('is-submitting');
    buttons.forEach((button, index) => {
      button.disabled = disabled[index];
    });
  }
}

export async function submitForm(
  event: SubmitEvent<HTMLFormElement>,
  post: Post,
  type: string,
  extra: Record<string, string> = {},
) {
  return withFormSubmission(event, async (form) => {
    const payload = serializeFormData(new FormData(form), type, extra);
    const saved = await post(payload);
    if (saved) form.reset();
    return saved;
  });
}
