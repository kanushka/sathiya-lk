// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type School } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';
import type { SetStatusFn } from './status';

export function StatusPill({ status }: { status: School['status'] }) {
  const { t } = useTranslation('superadmin');
  return (
    <Badge tone={status === 'active' ? 'success' : status === 'pending' ? 'warning' : 'danger'}>{t(`status.${status}`)}</Badge>
  );
}

export function useStatusToggle(school: School, setStatus: SetStatusFn) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const name = pickName(school, lang);
  const disabling = school.status === 'active';
  const visible = school.status !== 'pending' && school.status !== 'rejected';

  async function apply() {
    setBusy(true);
    try {
      await setStatus({ schoolId: school.id, status: disabling ? 'disabled' : 'active' });
      toast.show(t(disabling ? 'toast.disabled' : 'toast.enabled', { name }), 'success');
      setConfirming(false);
    } catch (err) {
      toast.show(t('toast.failed', { message: errorMessage(t, err) }), 'error');
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <Modal
      open={confirming}
      title={t('confirmDisable.title', { name })}
      width={460}
      onClose={() => setConfirming(false)}
      busy={busy}
      footer={
        <>
          <Button onClick={() => setConfirming(false)} disabled={busy}>{t('buttons.cancel', { ns: 'common' })}</Button>
          <Button variant="dangerSolid" loading={busy} onClick={() => void apply()}>
            {t('confirmDisable.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{t('confirmDisable.body')}</p>
    </Modal>
  );

  return {
    visible,
    disabling,
    busy,
    confirming,
    label: t(disabling ? 'schools.disable' : 'schools.enable'),
    start: () => (disabling ? setConfirming(true) : void apply()),
    modal,
  };
}

export function StatusButton({ school, setStatus }: { school: School; setStatus: SetStatusFn }) {
  const toggle = useStatusToggle(school, setStatus);
  if (!toggle.visible) return null;
  return (
    <>
      <Button
        size="sm"
        variant={toggle.disabling ? 'danger' : 'secondary'}
        loading={toggle.busy && !toggle.confirming}
        disabled={toggle.busy && toggle.confirming}
        onClick={toggle.start}
      >
        {toggle.label}
      </Button>
      {toggle.modal}
    </>
  );
}
