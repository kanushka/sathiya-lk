// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { inputClass } from '../../ui/Field';
import { FormError } from '../../ui/FormError';
import { cx } from '../../ui/cx';

export const PRIMARY_SWATCHES = ['#7A1F3D', '#1D3E7A', '#0E6B6A', '#2F6B2A', '#5B2C83', '#14213D'];
export const SECOND_SWATCHES = ['#D9A441', '#F2C94C', '#E07A3F', '#9CC3E6', '#C9CDD6', '#FFFFFF'];

const HEX = /^#[0-9a-fA-F]{6}$/;

export function isHex(v: string): boolean {
  return HEX.test(v);
}

export interface ColorSwatchesProps {
  label: string;
  swatches: string[];
  value: string;
  onChange(hex: string): void;
  hint?: string;
}

export function ColorSwatches({ label, swatches, value, onChange, hint }: ColorSwatchesProps) {
  const { t } = useTranslation('register');
  const id = useId();
  const upper = value.toUpperCase();
  const isPreset = swatches.some((s) => s.toUpperCase() === upper);
  const [custom, setCustom] = useState(isPreset ? '' : upper);
  const customInvalid = custom !== '' && !isHex(custom);

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2">
      <span id={`${id}-label`} className="text-[13px] font-semibold text-ink-soft">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {swatches.map((hex) => {
          const selected = hex.toUpperCase() === upper;
          return (
            <button
              key={hex}
              type="button"
              aria-label={hex}
              aria-pressed={selected}
              title={hex}
              onClick={() => {
                setCustom('');
                onChange(hex);
              }}
              style={{ background: hex }}
              className={cx(
                'h-9 w-9 cursor-pointer rounded-[10px]',
                selected ? 'shadow-[0_0_0_2px_#fff,0_0_0_4px_#14213D]' : 'border border-black/10',
              )}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label={t('brand.custom')}
          placeholder="#RRGGBB"
          maxLength={7}
          spellCheck={false}
          value={custom}
          aria-invalid={customInvalid ? true : undefined}
          onChange={(e) => {
            const v = e.target.value.startsWith('#') || e.target.value === '' ? e.target.value : `#${e.target.value}`;
            setCustom(v);
            if (isHex(v)) onChange(v.toUpperCase());
          }}
          className={cx(inputClass, 'h-9 w-32 font-mono')}
        />
        {customInvalid && (
          <FormError>{t('brand.customError')}</FormError>
        )}
      </div>
      {hint && <p className="m-0 text-xs text-ink-muted">{hint}</p>}
    </div>
  );
}
