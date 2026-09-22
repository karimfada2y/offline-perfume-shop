const CONVERSIONS: Record<string, number> = {
  ml: 1,
  l: 1000,
  liter: 1000,
  litera: 1000,
  g: 1,
  gram: 1,
  kg: 1000,
  piece: 1,
  pc: 1,
  unit: 1,
};

export function convertUnit(quantity: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) return quantity;
  const fromBase = CONVERSIONS[fromUnit.toLowerCase()] ?? 1;
  const toBase = CONVERSIONS[toUnit.toLowerCase()] ?? 1;
  return quantity * (fromBase / toBase);
}

export function getBaseUnit(unit: string): string {
  const lower = unit.toLowerCase();
  if (lower === 'l' || lower === 'liter' || lower === 'litera') return 'ml';
  if (lower === 'kg') return 'g';
  return lower;
}

export function formatUnit(quantity: number, unit: string): string {
  if (quantity >= 1000 && (unit.toLowerCase() === 'ml')) {
    return `${(quantity / 1000).toFixed(2)} L`;
  }
  if (quantity >= 1000 && (unit.toLowerCase() === 'g')) {
    return `${(quantity / 1000).toFixed(2)} kg`;
  }
  return `${quantity.toFixed(2)} ${unit}`;
}
