import type { Language } from '../i18n';

export function locale(language: Language) {
  return language === 'ru' ? 'ru-RU' : 'en-US';
}

export function money(value: number, language: Language) {
  return new Intl.NumberFormat(locale(language), {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 2,
  }).format(value);
}

export function percentage(value: number, language: Language) {
  return new Intl.NumberFormat(locale(language), {
    style: 'percent',
    maximumFractionDigits: 1,
  }).format(value);
}

export function quantity(value: number, language: Language) {
  return new Intl.NumberFormat(locale(language), {
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string, language: Language) {
  const date = new Date(`${value}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function dateTimeKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatDateTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatLongDateTime(value: string, language: Language) {
  return new Intl.DateTimeFormat(locale(language), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
