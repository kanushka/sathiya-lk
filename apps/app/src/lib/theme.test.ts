import { describe, expect, it } from 'vitest';
import { applyBrand, applyDefaultBrand, sathiyaBrand } from './theme';

describe('applyBrand', () => {
  const css = () => document.documentElement.style;

  it('sets brand vars and white on-brand for maroon', () => {
    applyBrand({ primary: '#7A1F3D', second: '#D9A441' });
    expect(css().getPropertyValue('--brand')).toBe('#7A1F3D');
    expect(css().getPropertyValue('--brand-2')).toBe('#D9A441');
    expect(css().getPropertyValue('--on-brand')).toBe('#FFFFFF');
  });

  it('uses navy on light brand colours', () => {
    applyBrand({ primary: '#F2A541', second: '#0E6B6A' });
    expect(css().getPropertyValue('--on-brand')).toBe('#14213D');
  });

  it('applies the Sathiya defaults', () => {
    applyDefaultBrand();
    expect(css().getPropertyValue('--brand')).toBe(sathiyaBrand.primary);
    expect(css().getPropertyValue('--brand-2')).toBe(sathiyaBrand.second);
  });
});
