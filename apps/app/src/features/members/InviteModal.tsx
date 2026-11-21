// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Teacher } from '@sathiya/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { Select } from '../../ui/Select';
import { useToast } from '../../ui/Toast';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface InviteModalProps {
  teachers: Teacher[];
  onInvite: (email: string, teacherId?: string) => Promise<void>;
  onClose: () => void;
}

export function InviteModal({ teachers, onInvite, onClose }: InviteModalProps) {
  const { t } = useTranslation('members');
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [saving, setSaving] = useState(false);
  const valid = EMAIL.test(email.trim());
  const showError = email.trim() !== '' && !valid;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !valid) return;
    setSaving(true);
    try {
      await onInvite(email.trim(), teacherId || undefined);
      toast.show(t('invite.sent', { email: email.trim() }), 'success');
      onClose();
    } catch {
      toast.show(t('invite.failed'), 'error');
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      width={460}
      title={t('invite.title')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('invite.cancel')}</Button>
          <Button variant="primary" type="submit" form="invite-form" disabled={saving || !valid}>
            {t('invite.send')}
          </Button>
        </>
      }
    >
      <form id="invite-form" onSubmit={submit} className="flex flex-col gap-3.5">
        <Field label={t('invite.email')} hint={t('invite.emailHint')} error={showError ? t('invite.emailError') : undefined}>
          <input type="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label={t('invite.teacher')}>
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
            <option value="">{t('invite.teacherNone')}</option>
            {teachers.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name} ({x.staffId})
              </option>
            ))}
          </Select>
        </Field>
      </form>
    </Modal>
  );
}
