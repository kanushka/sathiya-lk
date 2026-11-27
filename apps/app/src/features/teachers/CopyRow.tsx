// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { useToast } from '../../ui/Toast';

export interface CopyRowProps {
  title: string;
  url: string;
  copyLabel: string;
  /** Shorter text for the link line, for example without the host. */
  shown?: string;
  trailing?: ReactNode;
  children?: ReactNode;
}

/** A phone row for an app link: its name, the link on one line, then Copy. */
export function CopyRow({ title, url, copyLabel, shown, trailing, children }: CopyRowProps) {
  const { t } = useTranslation('common');
  const headingId = useId();
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
    <section aria-labelledby={headingId} className="mb-5 rounded-[14px] border border-line bg-white py-2.5 pl-4 pr-2">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 id={headingId} className="m-0 text-[15px] font-semibold text-ink">
            {title}
          </h2>
          <code className="block truncate text-xs text-ink-muted">{shown ?? url}</code>
        </div>
        <Button size="lg" aria-label={copyLabel} onClick={() => void copy()}>
          <span aria-live="polite">{copied ? t('clipboard.copied') : t('clipboard.copy')}</span>
        </Button>
        {trailing}
      </div>
      {children}
    </section>
  );
}

export const withoutHost = (url: string) => url.replace(/^https?:\/\//, '');
