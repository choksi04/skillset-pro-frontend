import { describe, it, expect } from 'vitest';
import { escapeCsvCell, toCsv, timestampedFilename } from './csv';

describe('csv', () => {
  it('escapes quotes, commas and newlines', () => {
    expect(escapeCsvCell('a "b", c\nd')).toBe('"a ""b"", c\nd"');
  });
  it('guards formula-like text', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe(`"'=SUM(A1)"`);
    expect(escapeCsvCell('@cmd')).toBe(`"'@cmd"`);
    expect(escapeCsvCell('-1+2')).toBe(`"'-1+2"`);
  });
  it('leaves numbers untouched including negatives', () => {
    expect(escapeCsvCell(-3)).toBe('"-3"');
    expect(escapeCsvCell(4.5)).toBe('"4.5"');
  });
  it('preserves unicode and adds BOM + CRLF', () => {
    const csv = toCsv(['Name'], [['Jürgen 日本']]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toBe('\uFEFF"Name"\r\n"Jürgen 日本"');
  });
  it('builds Team_Registry filename', () => {
    expect(timestampedFilename('Team_Registry', new Date(2026, 9, 13, 9, 5))).toBe('Team_Registry_2026-10-13_09-05.csv');
  });
});
