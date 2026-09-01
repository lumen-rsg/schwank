export type BillingCycle = 'monthly' | 'yearly';
export type NutritionSex = 'male' | 'female';
export type NutritionActivity = 'inactive' | 'low' | 'active' | 'very';
export type NutritionPlan = 'lose' | 'maintain' | 'gain';

const energyEquations: Record<
  NutritionSex,
  Record<NutritionActivity, [number, number, number, number]>
> = {
  male: {
    inactive: [753.07, -10.83, 6.5, 14.1],
    low: [581.47, -10.83, 8.3, 14.94],
    active: [1004.82, -10.83, 6.52, 15.91],
    very: [-517.88, -10.83, 15.61, 19.11],
  },
  female: {
    inactive: [584.9, -7.01, 5.72, 11.71],
    low: [575.77, -7.01, 6.6, 12.14],
    active: [710.25, -7.01, 6.54, 12.34],
    very: [511.83, -7.01, 9.07, 12.56],
  },
};

export function advancePaymentDate(date: string, cycle: BillingCycle) {
  const [year, month, day] = date.split('-').map(Number);
  const monthOffset = cycle === 'yearly' ? 12 : 1;
  const targetMonth = month - 1 + monthOffset;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(
    Date.UTC(targetYear, normalizedMonth + 1, 0),
  ).getUTCDate();
  return new Date(Date.UTC(targetYear, normalizedMonth, Math.min(day, lastDay)))
    .toISOString()
    .slice(0, 10);
}

export function calculateNutrition(
  sex: NutritionSex,
  activity: NutritionActivity,
  plan: NutritionPlan,
  age: number,
  heightCm: number,
  weightKg: number,
) {
  const [base, ageFactor, heightFactor, weightFactor] =
    energyEquations[sex][activity];
  const maintenance =
    Math.round(
      (base +
        ageFactor * age +
        heightFactor * heightCm +
        weightFactor * weightKg) /
        10,
    ) * 10;
  const planFactor = plan === 'lose' ? 0.9 : plan === 'gain' ? 1.1 : 1;
  const calories = Math.round((maintenance * planFactor) / 10) * 10;
  const ratios =
    plan === 'lose'
      ? { protein: 0.25, fat: 0.3 }
      : plan === 'gain'
        ? { protein: 0.2, fat: 0.25 }
        : { protein: 0.2, fat: 0.3 };
  const protein = Math.round((calories * ratios.protein) / 4);
  const fat = Math.round((calories * ratios.fat) / 9);
  const carbs = Math.round((calories - protein * 4 - fat * 9) / 4);
  return { maintenance, calories, protein, fat, carbs };
}
