import assert from 'node:assert/strict';
import test from 'node:test';
import {
  medicationAdherence,
  waterDailyHistoryWindow,
  waterHistoryWindow,
} from '../app/features/health/health-calculations';
import type {
  Medication,
  MedicationDose,
  WaterEntry,
} from '../app/features/types';

const water = (id: number, drunkOn: string, amountMl: number): WaterEntry => ({
  id,
  drunkOn,
  amountMl,
  createdAt: `${drunkOn}T10:00:00.000Z`,
});

void test('aggregates private hydration entries across calendar days', () => {
  const result = waterHistoryWindow(
    [
      water(1, '2026-08-25', 200),
      water(2, '2026-08-26', 300),
      water(3, '2026-08-31', 500),
      water(4, '2026-09-01', 700),
      water(5, '2026-09-02', 900),
    ],
    7,
    new Date(2026, 8, 1, 12),
  );
  assert.deepEqual(
    result.visible.map(({ id }) => id),
    [2, 3, 4],
  );
  assert.equal(result.daily[0].day, '2026-08-26');
  assert.equal(result.daily.at(-1)?.amountMl, 700);
  assert.equal(result.totalMl, 1500);
});

void test('keeps hydration totals exact when editable rows are paginated', () => {
  const result = waterDailyHistoryWindow(
    [
      { day: '2026-08-31', entryCount: 110, amountMl: 11_000 },
      { day: '2026-09-01', entryCount: 3, amountMl: 750 },
    ],
    2,
    new Date(2026, 8, 1, 12),
  );
  assert.equal(result.entryCount, 113);
  assert.equal(result.totalMl, 11_750);
  assert.equal(result.daily.at(-1)?.amountMl, 750);
});

void test('counts only elapsed scheduled doses inside an active course', () => {
  const medication = {
    id: 1,
    name: 'Test medication',
    dosage: '1 dose',
    instructions: '',
    scheduleTimes: ['08:00', '20:00'],
    startOn: '2026-08-31',
    endOn: null,
    supplyRemaining: 8,
    refillThreshold: 2,
    active: true,
    visibility: 'private',
    owned: true,
    ownerName: 'Test User',
  } satisfies Medication;
  const doses = [
    {
      id: 1,
      medicationId: 1,
      scheduledFor: '2026-08-31T08:00',
      takenAt: '2026-08-31T08:05:00.000Z',
      takenByName: 'Test User',
    },
    {
      id: 2,
      medicationId: 1,
      scheduledFor: '2026-09-01T08:00',
      takenAt: '2026-09-01T08:05:00.000Z',
      takenByName: 'Test User',
    },
  ] satisfies MedicationDose[];

  assert.deepEqual(
    medicationAdherence([medication], doses, 2, new Date(2026, 8, 1, 12)),
    { expected: 3, taken: 2, percent: 67 },
  );
});
