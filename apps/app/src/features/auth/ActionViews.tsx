// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ActionErrorView, ActionShell } from './ActionShell';
import { applyEmailCode, getRecoveredEmail } from './api';
import { useActionCode } from './useActionCode';

const linkButton =
  'inline-flex h-11 w-full items-center justify-center rounded-lg bg-navy px-5 text-[15px] font-semibold text-white no-underline';

export function InvalidLinkView() {
  const { t } = useTranslation('auth');
  return <ActionErrorView message={t('action.errors.badRequest')} />;
}

export function VerifyEmailView({ code }: { code: string }) {
  const { t } = useTranslation('auth');
  const run = useCallback(() => applyEmailCode(code), [code]);
  const state = useActionCode(run);
  if (state.status === 'error') {
    return <ActionErrorView message={t(`action.errors.${state.error}`)} />;
  }
  if (state.status === 'loading') {
    return (
      <ActionShell title={t('action.verify.working')}>
        <p className="m-0 text-ink-muted">{t('action.wait')}</p>
      </ActionShell>
    );
  }
  return (
    <ActionShell title={t('action.verify.title')}>
      <p className="mb-6 mt-0 text-ink-muted">{t('action.verify.body')}</p>
      <Link to="/register" className={linkButton}>
        {t('action.verify.continue')}
      </Link>
    </ActionShell>
  );
}

export function RecoverEmailView({ code }: { code: string }) {
  const { t } = useTranslation('auth');
  const run = useCallback(async () => {
    const email = await getRecoveredEmail(code);
    await applyEmailCode(code);
    return email;
  }, [code]);
  const state = useActionCode(run);
  if (state.status === 'error') {
    return <ActionErrorView message={t(`action.errors.${state.error}`)} />;
  }
  if (state.status === 'loading') {
    return (
      <ActionShell title={t('action.recover.working')}>
        <p className="m-0 text-ink-muted">{t('action.wait')}</p>
      </ActionShell>
    );
  }
  return (
    <ActionShell title={t('action.recover.title')}>
      <p className="mb-6 mt-0 text-ink-muted">{t('action.recover.body', { email: state.value })}</p>
      <Link to="/login" className={linkButton}>
        {t('action.toLogin')}
      </Link>
    </ActionShell>
  );
}
