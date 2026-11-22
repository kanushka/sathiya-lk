// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { EMAIL_RE, REPORT_REASONS, type ReportReason } from '@sathiya/core';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass, textareaClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { RadioGroup } from '../../ui/RadioGroup';
import { useToast } from '../../ui/Toast';
import { FormError } from '../../ui/FormError';
import { getDirectorySchool, reportSchool, type DirectorySchool } from './api';
import { toApiError } from '../../lib/callable';
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
  const [emailError, setEmailError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSchool(null);
    setReason(null);
    setDetails('');
    setEmail('');
    setError(null);
    setEmailError(null);
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
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      setEmailError(t('report.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    setEmailError(null);
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
      const api = toApiError(err);
      if (detailCode(err) === 'rate-limited') setError(t('report.rateLimited'));
      else if (api.code === 'invalid' && (api.details as { field?: unknown } | undefined)?.field === 'email') setEmailError(t('report.invalidEmail'));
      else setError(t('report.error'));
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
      busy={busy}
      width={520}
      footer={
        <>
          <Button onClick={onClose} disabled={busy}>
            {t('report.cancel')}
          </Button>
          <Button variant="primary" loading={busy} disabled={!school || !reason} onClick={() => void send()}>
            {busy ? t('report.sending') : t('report.send')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label={t('report.school')}>
          <SchoolSearch id="report-school" value={school} onChange={setSchool} />
        </Field>
        <RadioGroup
          name="report-reason"
          label={t('report.reason')}
          value={reason}
          onChange={setReason}
          options={REPORT_REASONS.map((r) => ({ value: r, label: t(`report.reasons.${r}`) }))}
        />
        <Field label={t('report.details')}>
          <textarea className={textareaClass} value={details} onChange={(e) => setDetails(e.target.value)} />
        </Field>
        <Field label={t('report.email')} error={emailError}>
          <input
            type="email"
            autoComplete="email"
            className={inputClass}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setEmailError(null);
            }}
          />
        </Field>
        {error && (
          <FormError>{error}</FormError>
        )}
      </div>
    </Modal>
  );
}
