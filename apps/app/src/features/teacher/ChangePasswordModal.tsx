// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Modal } from '../../ui/Modal';
import { useToast } from '../../ui/Toast';
import { FormError } from '../../ui/FormError';
import { passwordLongEnough } from '../../lib/password';
import { changePasswordWithFirebase, type ChangePasswordFn } from './firebasePassword';

export interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  changePassword?: ChangePasswordFn;
}

const wrongCodes = new Set(['auth/invalid-credential', 'auth/wrong-password']);
const weakCodes = new Set(['auth/weak-password', 'auth/password-does-not-meet-requirements']);

function errorCode(e: unknown): string | undefined {
  return typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : undefined;
}

export function ChangePasswordModal({ open, onClose, changePassword = changePasswordWithFirebase }: ChangePasswordModalProps) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title={useTitle()} width={420} busy={busy}>
      <PasswordForm onClose={onClose} changePassword={changePassword} busy={busy} setBusy={setBusy} />
    </Modal>
  );
}

function useTitle(): string {
  const { t } = useTranslation('teacher');
  return t('cp.title');
}

function PasswordForm({
  onClose,
  changePassword,
  busy,
  setBusy,
}: {
  onClose: () => void;
  changePassword: ChangePasswordFn;
  busy: boolean;
  setBusy: (b: boolean) => void;
}) {
  const { t } = useTranslation('teacher');
  const toast = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string; form?: string }>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    const found: typeof errors = {};
    if (!passwordLongEnough(next)) found.next = t('cp.tooShort');
    else if (next !== confirm) found.confirm = t('cp.mismatch');
    setErrors(found);
    if (found.next || found.confirm) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      toast.show(t('cp.done'), 'success');
      onClose();
    } catch (err) {
      const code = errorCode(err);
      if (code && weakCodes.has(code)) setErrors({ next: t('cp.tooShort') });
      else setErrors(code && wrongCodes.has(code) ? { current: t('cp.wrongCurrent') } : { form: t('cp.failed') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <Field label={t('cp.current')} error={errors.current}>
        <input type="password" autoComplete="current-password" className={inputClass} value={current} onChange={(e) => setCurrent(e.target.value)} required />
      </Field>
      <Field label={t('cp.new')} error={errors.next}>
        <input type="password" autoComplete="new-password" className={inputClass} value={next} onChange={(e) => setNext(e.target.value)} required />
      </Field>
      <Field label={t('cp.confirm')} error={errors.confirm}>
        <input type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
      </Field>
      {errors.form && (
        <FormError>{errors.form}</FormError>
      )}
      <Button type="submit" variant="primary" size="lg" loading={busy}>
        {t('cp.submit')}
      </Button>
    </form>
  );
}
