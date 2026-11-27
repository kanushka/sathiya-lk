// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { paths, type PlatformConfig } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDoc, type DocState } from '../../lib/firestore';
import { Button } from '../../ui/Button';
import { Field, textareaClass } from '../../ui/Field';
import { EmptyState } from '../../ui/EmptyState';
import { LoadingState } from '../../ui/LoadingState';
import { Switch } from '../../ui/Switch';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';
import { announcementText, BannerView } from './AnnouncementBanner';
import { firestorePlatformWriter, type PlatformWriter } from './platform';

export interface AnnouncementsPageProps {
  config?: DocState<PlatformConfig>;
  writer?: PlatformWriter;
}

export function AnnouncementsPage({ config: injected, writer = firestorePlatformWriter }: AnnouncementsPageProps) {
  const live = useDoc<PlatformConfig>(injected ? null : paths.platform.config);
  const state = injected ?? live;
  const { t } = useTranslation('superadmin');
  if (state.loading) return <LoadingState />;
  if (state.error) return <EmptyState icon="search" title={t('announcements.loadError')} />;
  return <AnnouncementForm initial={state.data?.announcement} writer={writer} />;
}

function AnnouncementForm({ initial, writer }: { initial: PlatformConfig['announcement']; writer: PlatformWriter }) {
  const { t } = useTranslation('superadmin');
  const toast = useToast();
  const [textEn, setTextEn] = useState(initial?.textEn ?? '');
  const [textSi, setTextSi] = useState(initial?.textSi ?? '');
  const [active, setActive] = useState(initial?.active ?? false);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!textEn.trim()) {
      setError(true);
      return;
    }
    setError(false);
    setBusy(true);
    try {
      await writer.saveAnnouncement({ textEn: textEn.trim(), textSi: textSi.trim(), active, updatedAt: Date.now() });
      toast.show(t('announcements.saved'), 'success');
    } catch (err) {
      toast.show(t('announcements.failed', { message: errorMessage(t, err) }), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[720px]">
      <h1 className="mb-1 text-[22px] font-bold md:text-[26px]">{t('announcements.title')}</h1>
      <p className="mb-5 text-sm text-ink-muted">{t('announcements.intro')}</p>
      <div className="flex flex-col gap-4 rounded-[14px] border border-line bg-white p-4 md:p-5">
        <Field label={t('announcements.textEn')} error={error ? t('announcements.textEnRequired') : undefined}>
          <textarea rows={3} className={textareaClass} value={textEn} onChange={(e) => setTextEn(e.target.value)} />
        </Field>
        <Field label={t('announcements.textSi')} hint={t('announcements.textSiHint')}>
          <textarea rows={3} className={textareaClass} value={textSi} onChange={(e) => setTextSi(e.target.value)} />
        </Field>
        <Switch checked={active} onChange={setActive} label={t('announcements.active')} />
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-soft">{t('announcements.preview')}</p>
          <div data-testid="banner-preview" className="overflow-hidden rounded-lg border border-line">
            {textEn.trim() ? (
              <BannerView text={announcementText({ textEn, textSi, active: true, updatedAt: 0 }, 'en')} />
            ) : (
              <p className="px-4 py-2.5 text-sm text-ink-muted">{t('announcements.previewEmpty')}</p>
            )}
          </div>
        </div>
        <div>
          <Button variant="primary" className="w-full md:w-auto" loading={busy} loadingLabel={t('busy.saving', { ns: 'common' })} onClick={() => void save()}>
            {t('buttons.save', { ns: 'common' })}
          </Button>
        </div>
      </div>
    </div>
  );
}
