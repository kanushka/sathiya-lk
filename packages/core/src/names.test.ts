import { describe, expect, it } from 'vitest';
import { pickName } from './names';

describe('pickName', () => {
  it('falls back to English when Sinhala empty', () => {
    expect(pickName({ nameEn: 'Maths', nameSi: '' }, 'si')).toBe('Maths');
    expect(pickName({ nameEn: 'Maths', nameSi: '  ' }, 'si')).toBe('Maths');
    expect(pickName({ nameEn: 'Maths' }, 'si')).toBe('Maths');
  });
  it('uses Sinhala when present', () => {
    expect(pickName({ nameEn: 'Maths', nameSi: 'ගණිතය' }, 'si')).toBe('ගණිතය');
  });
  it('en returns English', () => {
    expect(pickName({ nameEn: 'Maths', nameSi: 'ගණිතය' }, 'en')).toBe('Maths');
  });
});
