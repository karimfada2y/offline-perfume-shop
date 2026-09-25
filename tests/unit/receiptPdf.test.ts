import { describe, it, expect } from 'vitest';
import { parsePaperWidthMm } from '../../src/renderer/utils/pdf';

describe('Receipt PDF Paper Geometry', () => {
  it('parses millimetre widths used by the store settings', () => {
    expect(parsePaperWidthMm('58mm')).toBe(58);
    expect(parsePaperWidthMm('72mm')).toBe(72);
    expect(parsePaperWidthMm('80mm')).toBe(80);
  });

  it('parses the A4 receipt width option', () => {
    expect(parsePaperWidthMm('A4')).toBe(210);
    expect(parsePaperWidthMm('a4')).toBe(210);
  });

  it('is tolerant of casing and surrounding whitespace', () => {
    expect(parsePaperWidthMm('  80MM ')).toBe(80);
  });

  it('falls back to 80mm for missing or unrecognised values', () => {
    expect(parsePaperWidthMm(undefined)).toBe(80);
    expect(parsePaperWidthMm(null)).toBe(80);
    expect(parsePaperWidthMm('')).toBe(80);
    expect(parsePaperWidthMm('0mm')).toBe(80);
    expect(parsePaperWidthMm('roll')).toBe(80);
  });

  it('keeps the receipt narrower than the A4 height limit so one page fits', () => {
    const thermalWidth = parsePaperWidthMm('80mm');
    const a4Width = parsePaperWidthMm('A4');

    expect(thermalWidth).toBeLessThan(105);
    expect(a4Width).toBeGreaterThan(105);
    expect(a4Width).toBe(210);
  });
});
