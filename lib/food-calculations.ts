export type FoodUnit = 'g' | 'kg' | 'ml' | 'l' | 'pcs';

export const foodUnitDimension: Record<FoodUnit, 'mass' | 'volume' | 'count'> =
  {
    g: 'mass',
    kg: 'mass',
    ml: 'volume',
    l: 'volume',
    pcs: 'count',
  };

export const foodUnitScale: Record<FoodUnit, number> = {
  g: 1,
  kg: 1000,
  ml: 1,
  l: 1000,
  pcs: 1,
};

export type PantryStock = {
  id: number;
  normalizedName: string;
  quantity: number;
  unit: FoodUnit;
  expiresOn: string | null;
};

export type PantryNeed = {
  name: string;
  normalizedName: string;
  quantity: number;
  unit: FoodUnit;
};

export type PantryDeduction = {
  id: number;
  amount: number;
};

export type MissingPantryItem = {
  name: string;
  amount: number;
  unit: FoodUnit;
};

export function planPantryDeduction(
  stocks: PantryStock[],
  ingredients: PantryNeed[],
  servingFactor: number,
  today: string,
) {
  const required = new Map<
    string,
    { name: string; unit: FoodUnit; amountBase: number }
  >();
  for (const ingredient of ingredients) {
    const dimension = foodUnitDimension[ingredient.unit];
    const key = `${ingredient.normalizedName}|${dimension}`;
    const current = required.get(key);
    required.set(key, {
      name: current?.name ?? ingredient.name,
      unit: current?.unit ?? ingredient.unit,
      amountBase:
        (current?.amountBase ?? 0) +
        ingredient.quantity * servingFactor * foodUnitScale[ingredient.unit],
    });
  }

  const available = stocks
    .filter(
      (stock) =>
        stock.quantity > 0 && (!stock.expiresOn || stock.expiresOn >= today),
    )
    .sort((left, right) => {
      if (left.expiresOn && right.expiresOn)
        return (
          left.expiresOn.localeCompare(right.expiresOn) || left.id - right.id
        );
      if (left.expiresOn) return -1;
      if (right.expiresOn) return 1;
      return left.id - right.id;
    });
  const usedBase = new Map<number, number>();
  const missing: MissingPantryItem[] = [];

  for (const [key, need] of required) {
    const [normalizedName, dimension] = key.split('|');
    let remainingBase = need.amountBase;
    for (const stock of available) {
      if (
        remainingBase <= 0.0001 ||
        stock.normalizedName !== normalizedName ||
        foodUnitDimension[stock.unit] !== dimension
      )
        continue;
      const stockBase =
        stock.quantity * foodUnitScale[stock.unit] -
        (usedBase.get(stock.id) ?? 0);
      const takeBase = Math.min(remainingBase, Math.max(0, stockBase));
      if (takeBase <= 0) continue;
      usedBase.set(stock.id, (usedBase.get(stock.id) ?? 0) + takeBase);
      remainingBase -= takeBase;
    }
    if (remainingBase > 0.0001)
      missing.push({
        name: need.name,
        amount: remainingBase / foodUnitScale[need.unit],
        unit: need.unit,
      });
  }

  const deductions: PantryDeduction[] = available.flatMap((stock) => {
    const amountBase = usedBase.get(stock.id) ?? 0;
    return amountBase > 0
      ? [{ id: stock.id, amount: amountBase / foodUnitScale[stock.unit] }]
      : [];
  });
  return { deductions, missing };
}

export function isLowFoodStock(quantity: number, unit: FoodUnit) {
  if (quantity <= 0) return false;
  if (unit === 'pcs') return quantity <= 2;
  if (unit === 'kg' || unit === 'l') return quantity <= 0.5;
  return quantity <= 500;
}
