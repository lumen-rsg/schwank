import { ApiError } from '@/lib/api-errors';
import { reminderRecurrences, type ReminderRecurrence } from '@/lib/reminders';

export type DataAction = Record<string, unknown>;
export const today = () => new Date().toISOString().slice(0, 10);
export const asText = (value: unknown, fallback = '') =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : fallback;
export const cleanText = (value: unknown, maximum: number, fallback = '') =>
  asText(value, fallback).trim().slice(0, maximum);
export const cleanNumber = (value: unknown, maximum = 1_000_000) =>
  Math.max(0, Math.min(maximum, Number(value) || 0));
export const cleanVisibility = (value: unknown) =>
  value === 'shared' ? 'shared' : 'private';
export const cleanDate = (value: unknown) => {
  const date = cleanText(value, 10, today());
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date > today()
  )
    throw new DataError('Enter a valid date that is not in the future.');
  return date;
};
export const normalizeFoodName = (value: string) =>
  value.normalize('NFKC').trim().toLocaleLowerCase('en').replace(/\s+/g, ' ');
export const cleanFoodUnit = (value: unknown) =>
  ['g', 'kg', 'ml', 'l', 'pcs'].includes(String(value)) ? String(value) : null;
export const foodCategories = [
  'pantry',
  'fridge',
  'freezer',
  'produce',
  'drinks',
  'other',
] as const;
export type FoodCategory = (typeof foodCategories)[number];
export const cleanFoodCategory = (value: unknown): FoodCategory =>
  foodCategories.includes(value as FoodCategory)
    ? (value as FoodCategory)
    : 'other';
export const cleanOptionalDate = (value: unknown) => {
  const date = cleanText(value, 10);
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new DataError('Enter a valid expiry date.');
  return date;
};
export const cleanPaymentDate = (value: unknown) => {
  const date = cleanText(value, 10);
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  )
    throw new DataError('Enter a valid payment date.');
  return date;
};
export const cleanDateTime = (value: unknown) => {
  const dateTime = cleanText(value, 16);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(dateTime))
    throw new DataError('Enter a valid reminder date and time.');
  const [date, time] = dateTime.split('T');
  const [hours, minutes] = time.split(':').map(Number);
  cleanPaymentDate(date);
  if (hours > 23 || minutes > 59)
    throw new DataError('Enter a valid reminder date and time.');
  return dateTime;
};
export const cleanReminderRecurrence = (value: unknown): ReminderRecurrence =>
  reminderRecurrences.includes(value as ReminderRecurrence)
    ? (value as ReminderRecurrence)
    : 'none';
export const cleanMedicationTimes = (value: unknown) => {
  const times = Array.from(
    new Set(
      cleanText(value, 80)
        .split(',')
        .map((time) => time.trim())
        .filter(Boolean),
    ),
  );
  if (
    !times.length ||
    times.length > 8 ||
    times.some((time) => {
      if (!/^\d{2}:\d{2}$/.test(time)) return true;
      const [hours, minutes] = time.split(':').map(Number);
      return hours > 23 || minutes > 59;
    })
  )
    throw new DataError('Add 1–8 medication times in HH:MM format.');
  return times.sort();
};
export const expenseCategories = [
  'groceries',
  'housing',
  'rent',
  'utilities',
  'subscriptions',
  'loan',
  'furniture',
  'transport',
  'health',
  'leisure',
  'other',
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];
export const cleanExpenseCategory = (value: unknown): ExpenseCategory =>
  expenseCategories.includes(value as ExpenseCategory)
    ? (value as ExpenseCategory)
    : 'other';
export const paymentKinds = ['subscription', 'loan', 'rent'] as const;
export type PaymentKind = (typeof paymentKinds)[number];
export const cleanPaymentKind = (value: unknown): PaymentKind | null =>
  paymentKinds.includes(value as PaymentKind) ? (value as PaymentKind) : null;
export const recipeCourses = [
  'breakfast',
  'starter',
  'main',
  'dinner',
  'salad',
  'dessert',
] as const;
export type RecipeCourse = (typeof recipeCourses)[number];
export const cleanRecipeCourse = (value: unknown): RecipeCourse | null =>
  recipeCourses.includes(value as RecipeCourse)
    ? (value as RecipeCourse)
    : null;

export class DataError extends ApiError {}
