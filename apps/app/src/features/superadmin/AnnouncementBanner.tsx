// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useDoc } from '../../lib/firestore';
import { Icon } from '../../ui/Icon';
import type { PlatformConfig } from './platform';

const storageKey = 'sathiya.announcement.dismissed';

function readDismissed(): string | null {
  try {
    return sessionStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

export function BannerView({ text, onDismiss }: { text: string; onDismiss?: () => void }) {
  const { t } = useTranslation('superadmin');
  return (
    <div role="status" className="flex items-center bg-saffron text-navy">
      <p className="flex-1 px-4 py-2.5 text-sm font-semibold">{text}</p>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t('announcements.dismiss')}
          title={t('announcements.dismiss')}
          className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-black/10"
        >
          <Icon name="close" size={16} />
        </button>
      )}
    </div>
  );
}

export function announcementText(a: PlatformConfig['announcement'], lang: string): string {
  if (!a?.active) return '';
  const si = a.textSi?.trim();
  return ((lang === 'si' && si ? si : a.textEn) ?? '').trim();
}

export function AnnouncementBanner({ config }: { config?: PlatformConfig }) {
  const { lang } = useLang();
  const live = useDoc<PlatformConfig>(config ? null : paths.platform.config);
  const a = (config ?? live.data)?.announcement;
  const [dismissed, setDismissed] = useState(readDismissed);
  const text = announcementText(a, lang);
  const stamp = String(a?.updatedAt ?? 0);
  if (!text || dismissed === stamp) return null;

  function dismiss() {
    try {
      sessionStorage.setItem(storageKey, stamp);
    } catch {
      // storage unavailable; dismissal lasts until reload
    }
    setDismissed(stamp);
  }

  return <BannerView text={text} onDismiss={dismiss} />;
}
