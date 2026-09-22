export function toCamel(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase());
    out[camel] = v;
    out[k] = v;
  }
  return out;
}

export function toCamelAll(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.map(toCamel);
}

export function safe(...args: unknown[]): unknown[] {
  return args.map(v => v === undefined ? null : v);
}
