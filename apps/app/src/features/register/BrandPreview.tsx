import { onColor } from '@sathiya/core';
import { useTranslation } from 'react-i18next';

export interface BrandPreviewProps {
  name: string;
  primary: string;
  second: string;
  logoUrl?: string | null;
  year?: string;
}

export function BrandPreview({ name, primary, second, logoUrl, year }: BrandPreviewProps) {
  const { t } = useTranslation('register');
  const on = onColor(primary);
  return (
    <div className="flex flex-col gap-2">
      <span className="text-[13px] font-semibold text-ink-soft">{t('brand.preview')}</span>
      <div data-testid="brand-preview" className="overflow-hidden rounded-xl border border-line">
        <div className="flex items-center gap-2.5 p-3.5" style={{ background: primary, color: on }}>
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-9 w-9 rounded-lg bg-white object-contain" />
          ) : (
            <span aria-hidden="true" className="h-9 w-9 rounded-lg" style={{ background: second }} />
          )}
          <div>
            <strong className="block text-sm">{name}</strong>
            <span className="text-xs opacity-80">{t('brand.previewTimetable', { year: year ?? new Date().getFullYear() })}</span>
          </div>
        </div>
        <div className="bg-[#FAFAFB] p-3.5">
          <div className="rounded-[10px] bg-white p-3" style={{ border: `2px solid ${second}` }}>
            <span className="rounded-full bg-[#FBF1DC] px-2 py-[3px] text-[11px] font-bold tracking-[.06em] text-[#7A5410]">
              {t('brand.previewNow')}
            </span>
            <p className="mb-0 mt-2 font-bold">{t('brand.previewLesson')}</p>
          </div>
          <div className="mt-3 flex gap-2">
            <span
              data-testid="preview-button"
              className="flex h-9 flex-1 items-center justify-center rounded-lg text-[13px] font-semibold"
              style={{ background: primary, color: on }}
            >
              {t('brand.previewPrimary')}
            </span>
            <span className="flex h-9 flex-1 items-center justify-center rounded-lg border border-line-strong text-[13px] font-semibold">
              {t('brand.previewSecondary')}
            </span>
          </div>
        </div>
      </div>
      <p className="m-0 text-xs text-ink-muted">{t('brand.previewNote')}</p>
    </div>
  );
}
