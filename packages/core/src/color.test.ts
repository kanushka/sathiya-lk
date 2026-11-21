import { describe, expect, it } from 'vitest';
import { onColor } from './color';

describe('onColor', () => {
  it('picks white on dark', () => {
    expect(onColor('#7A1F3D')).toBe('#FFFFFF');
  });
  it('picks navy on light', () => {
    expect(onColor('#F2C94C')).toBe('#14213D');
  });
  it('accepts #RGB', () => {
    expect(onColor('#000')).toBe('#FFFFFF');
    expect(onColor('#fff')).toBe('#14213D');
  });
});
