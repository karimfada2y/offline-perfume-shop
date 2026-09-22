const MONEY_SCALE = 100;

export function roundMoney(value: number): number {
  return Math.round(value * MONEY_SCALE) / MONEY_SCALE;
}

export function addMoney(...values: number[]): number {
  let total = 0;
  for (const v of values) {
    total += Math.round(v * MONEY_SCALE);
  }
  return total / MONEY_SCALE;
}

export function subtractMoney(a: number, b: number): number {
  return (Math.round(a * MONEY_SCALE) - Math.round(b * MONEY_SCALE)) / MONEY_SCALE;
}

export function multiplyMoney(a: number, b: number): number {
  return Math.round(a * b * MONEY_SCALE) / MONEY_SCALE;
}

export function divideMoney(a: number, b: number): number {
  if (b === 0) return 0;
  return Math.round((a / b) * MONEY_SCALE) / MONEY_SCALE;
}
