// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { REPORT_REASONS, type ReportReason } from '@sathiya/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { getDirectorySchool, reportSchool, type DirectorySchool } from './api';
import { detailCode } from './errors';
import { SchoolSearch } from './SchoolSearch';


export interface ReportSchoolModalProps {
  open: boolean;
  onClose(): void;
  initialSchoolId?: string;
}

export function ReportSchoolModal({ open, onClose, initialSchoolId }: ReportSchoolModalProps) {
  const { t } = useTranslation('auth');
  const toast = useToast();
  const [school, setSchool] = useState<DirectorySchool | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSchool(null);
    setReason(null);
    setDetails('');
    setEmail('');
    setError(null);
    if (!initialSchoolId) return;
    let live = true;
    getDirectorySchool(initialSchoolId).then(
      (s) => live && s && setSchool(s),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [open, initialSchoolId]);

  async function send() {
    if (!school || !reason) return;
    setBusy(true);
    setError(null);
    try {
      await reportSchool({
        schoolId: school.id,
        reason,
        ...(details.trim() ? { details: details.trim() } : {}),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      toast.show(t('report.sent'), 'success');
      onClose();
    } catch (err) {
      setError(detailCode(err) === 'rate-limited' ? t('report.rateLimited') : t('report.error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title={t('report.title')}
      subtitle={t('report.subtitle')}
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('report.cancel')}
          </Button>
          <Button variant="primary" disabled={busy || !school || !reason} onClick={() => void send()}>
            {busy ? t('report.sending') : t('report.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('report.school')}>
          <SchoolSearch id="report-school" value={school} onChange={setSchool} />
        </Field>
        <fieldset className="m-0 border-0 p-0">
          <legend className="mb-1.5 p-0 text-[13px] font-semibold text-ink-soft">{t('report.reason')}</legend>
          <div className="flex flex-col gap-2">
            {REPORT_REASONS.map((r) => (
              <label key={r} className="flex items-center gap-2.5 text-sm">
                <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
                {t(`report.reasons.${r}`)}
              </label>
            ))}
          </div>
        </fieldset>
        <Field label={t('report.details')}>
          <textarea className={`${inputClass} h-20 py-2`} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <Field label={t('report.email')}>
          <input type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="m-0 text-sm font-medium text-[#A3262A]">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
