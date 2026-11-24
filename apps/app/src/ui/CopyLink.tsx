// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useToast } from './Toast';

export interface CopyLinkProps {
  url: string;
  copyLabel: string;
  label?: string;
  hint?: string;
}

export function CopyLink({ url, copyLabel, label, hint }: CopyLinkProps) {
  const { t } = useTranslation('common');
  const toast = useToast();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      toast.show(t('clipboard.failed'), 'error');
    }
  }

  return (
    <div className="min-w-0">
      {label && <p className="m-0 text-[13px] font-semibold text-ink-soft">{label}</p>}
      {hint && <p className="m-0 text-xs text-ink-muted">{hint}</p>}
      <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
        <code className="min-w-0 break-all text-sm text-brand">{url}</code>
        <Button size="sm" aria-label={copyLabel} onClick={() => void copy()}>
          <span aria-live="polite">{copied ? t('clipboard.copied') : t('clipboard.copy')}</span>
        </Button>
      </div>
    </div>
  );
}
