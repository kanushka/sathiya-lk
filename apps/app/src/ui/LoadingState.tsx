import { useTranslation } from 'react-i18next';

export function LoadingState() {
  const { t } = useTranslation('shell');
  return (
    <div role="status" className="flex min-h-[50vh] items-center justify-center gap-3 text-sm text-ink-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-brand"
      />
      {t('loading')}
    </div>
  );
}
