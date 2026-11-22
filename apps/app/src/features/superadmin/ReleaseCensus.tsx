// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, type ReleaseCensusNoReq, type ReleaseCensusNoRes, type School } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { call } from '../../lib/callable';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { errorMessage } from './errors';

export type ReleaseCensusFn = (req: ReleaseCensusNoReq) => Promise<ReleaseCensusNoRes>;

export const defaultReleaseCensus: ReleaseCensusFn = (req) => call('releaseCensusNo', req);

export function ReleaseCensusButton({ school, release }: { school: School; release: ReleaseCensusFn }) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<string>();
  const censusNo = pending ?? school.censusNo;
  if (!censusNo) return null;
  const name = pickName(school, lang);

  function open() {
    setPending(school.censusNo);
    setConfirming(true);
  }

  function close() {
    setConfirming(false);
    setPending(undefined);
  }

  async function apply() {
    setBusy(true);
    try {
      const res = await release({ schoolId: school.id });
      toast.show(t(res.freed ? 'releaseCensus.toast.released' : 'releaseCensus.toast.cleared', { censusNo: res.censusNo, name }), 'success');
    } catch (err) {
      toast.show(t('releaseCensus.toast.failed', { message: errorMessage(t, err) }), 'error');
    } finally {
      setBusy(false);
      setConfirming(false);
      setPending(undefined);
    }
  }

  return (
    <>
      <Button size="sm" variant="danger" disabled={busy} onClick={open}>
        {t('releaseCensus.button')}
      </Button>
      <Modal
        open={confirming}
        title={t('releaseCensus.title', { censusNo })}
        width={480}
        onClose={() => !busy && close()}
        busy={busy}
        footer={
          <>
            <Button disabled={busy} onClick={close}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button variant="dangerSolid" loading={busy} onClick={() => void apply()}>
              {t('releaseCensus.confirm', { censusNo })}
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-soft">{t('releaseCensus.body', { censusNo, name })}</p>
      </Modal>
    </>
  );
}
