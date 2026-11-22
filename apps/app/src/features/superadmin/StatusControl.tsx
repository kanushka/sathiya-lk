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
    <Badge tone={status === 'active' ? 'success' : 'danger'}>{t(`status.${status}`)}</Badge>
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
      toast.show(t('toast.failed', { message: errorMessage(t, err) }), 'error');
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
        loading={busy && !confirming}
        disabled={busy && confirming}
        onClick={() => (disabling ? setConfirming(true) : void apply())}
      >
        {t(disabling ? 'schools.disable' : 'schools.enable')}
      </Button>
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
    </>
  );
}
