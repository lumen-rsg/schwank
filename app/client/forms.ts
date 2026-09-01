import type { SubmitEvent } from 'react';
import type { Post } from '../features/types';

export async function submitForm(
  event: SubmitEvent<HTMLFormElement>,
  post: Post,
  type: string,
  extra: Record<string, string> = {},
) {
  event.preventDefault();
  const form = event.currentTarget;
  const values = Object.fromEntries(new FormData(form).entries());
  const payload: Record<string, string | number | boolean> = { type, ...extra };
  for (const [key, value] of Object.entries(values)) {
    if (typeof value !== 'string') continue;
    payload[key] = [
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
    ].includes(key)
      ? Number(value)
      : value;
  }
  if (await post(payload)) form.reset();
}
