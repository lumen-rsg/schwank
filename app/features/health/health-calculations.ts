import { dateKey } from '../../client/dates';
import type { Medication, MedicationDose, WaterEntry } from '../types';

function calendarDays(days: number, today: Date) {
  const anchor = new Date(today);
  anchor.setHours(12, 0, 0, 0);
  return Array.from({ length: Math.max(1, days) }, (_, index) => {
    const day = new Date(anchor);
    day.setDate(anchor.getDate() - (days - index - 1));
    return dateKey(day);
  });
}

export function waterHistoryWindow(
  entries: WaterEntry[],
  days: number,
  today = new Date(),
) {
  const dates = calendarDays(days, today);
  const visible = entries.filter(
    (entry) =>
      entry.drunkOn >= dates[0] && entry.drunkOn <= dates[dates.length - 1],
  );
  const daily = dates.map((day) => ({
    day,
    amountMl: visible
      .filter((entry) => entry.drunkOn === day)
      .reduce((total, entry) => total + Number(entry.amountMl), 0),
  }));
  return {
    visible,
    daily,
    totalMl: daily.reduce((total, day) => total + day.amountMl, 0),
  };
}

export function medicationAdherence(
  medications: Medication[],
  doses: MedicationDose[],
  days: number,
  now = new Date(),
) {
  const dates = calendarDays(days, now);
  const currentDate = dateKey(now);
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes(),
  ).padStart(2, '0')}`;
  const expected = medications.flatMap((medication) =>
    dates.flatMap((day) => {
      if (
        !medication.active ||
        day < medication.startOn ||
        (medication.endOn && day > medication.endOn)
      )
        return [];
      return medication.scheduleTimes
        .filter((time) => day < currentDate || time <= currentTime)
        .map((time) => `${medication.id}:${day}T${time}`);
    }),
  );
  const takenKeys = new Set(
    doses.map((dose) => `${dose.medicationId}:${dose.scheduledFor}`),
  );
  const taken = expected.filter((key) => takenKeys.has(key)).length;
  return {
    expected: expected.length,
    taken,
    percent: expected.length ? Math.round((taken / expected.length) * 100) : 0,
  };
}
