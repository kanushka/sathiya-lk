// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import type { SetStatusFn } from './status';

export function StatusPill({ status }: { status: School['status'] }) {
  const { t } = useTranslation('superadmin');
  return (
    <span
      className={
        status === 'active'
          ? 'rounded-full bg-[#E4F2E7] px-2.5 py-0.5 text-xs font-bold text-[#1F6B34]'
          : 'rounded-full bg-[#F6E3E3] px-2.5 py-0.5 text-xs font-bold text-[#A3262A]'
      }
    >
      {t(`status.${status}`)}
    </span>
  );
}

export function StatusButton({ school, setStatus }: { school: School; setStatus: SetStatusFn }) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = pickName(school, lang);
  const disabling = school.status === 'active';

  async function apply() {
    setBusy(true);
    try {
      await setStatus({ schoolId: school.id, status: disabling ? 'disabled' : 'active' });
      toast.show(t(disabling ? 'toast.disabled' : 'toast.enabled', { name }), 'success');
      setConfirming(false);
    } catch (err) {
      toast.show(t('toast.failed', { message: err instanceof Error ? err.message : String(err) }), 'error');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant={disabling ? 'danger' : 'secondary'}
        disabled={busy}
        onClick={() => (disabling ? setConfirming(true) : void apply())}
      >
        {t(disabling ? 'schools.disable' : 'schools.enable')}
      </Button>
      <Modal
        open={confirming}
        title={t('confirmDisable.title', { name })}
        width={460}
        onClose={() => setConfirming(false)}
        footer={
          <>
            <Button onClick={() => setConfirming(false)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button variant="danger" disabled={busy} onClick={() => void apply()}>
              {t('confirmDisable.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{t('confirmDisable.body')}</p>
      </Modal>
    </>
  );
}
