// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { FormError } from '../../ui/FormError';

export const MAX_LOGO_BYTES = 1024 * 1024;
const ACCEPT = ['image/png', 'image/svg+xml'];

export interface LogoUploadProps {
  value: File | null;
  currentUrl?: string | null;
  onChange(file: File | null): void;
  onPreview?(url: string | null): void;
}

export function LogoUpload({ value, currentUrl, onChange, onPreview }: LogoUploadProps) {
  const { t } = useTranslation('register');
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!value || typeof URL.createObjectURL !== 'function') {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreview(url);
    return () => URL.revokeObjectURL?.(url);
  }, [value]);

  const shown = preview ?? currentUrl ?? null;
  useEffect(() => {
    onPreview?.(shown);
  }, [shown, onPreview]);

  function pick(file: File | undefined) {
    if (!file) return;
    if (!ACCEPT.includes(file.type)) {
      setError(t('logo.typeError'));
    } else if (file.size > MAX_LOGO_BYTES) {
      setError(t('logo.sizeError'));
    } else {
      setError(null);
      onChange(file);
    }
    if (input.current) input.current.value = '';
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-[13px] font-semibold text-ink-soft">
        {t('brand.logo')}
      </span>
      <div className="flex items-center gap-3.5 rounded-xl border-[1.5px] border-dashed border-line-strong p-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-50">
          {shown ? <img src={shown} alt={t('logo.alt')} className="h-full w-full object-contain" /> : null}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <input
            ref={input}
            id={id}
            type="file"
            accept=".png,.svg,image/png,image/svg+xml"
            aria-labelledby={`${id}-label`}
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0])}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => input.current?.click()}>
              {shown ? t('logo.change') : t('logo.choose')}
            </Button>
            {value && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                {t('logo.remove')}
              </Button>
            )}
          </div>
          <p className="m-0 text-xs text-ink-muted">{t('logo.hint')}</p>
        </div>
      </div>
      {error && (
        <FormError>{error}</FormError>
      )}
    </div>
  );
}
