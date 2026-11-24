// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router-dom';
import { useLang } from '../../app/LangProvider';
import { Button } from '../../ui/Button';
import * as registerApi from '../register/api';
import { accountCreateError } from '../register/errors';
import { emptyAccount, type AccountDraft } from '../register/model';
import { StepAccount } from '../register/StepAccount';
import { VerifyEmailGate } from '../register/VerifyEmailGate';
import { sendAuthEmail } from './authEmail';
import { returnPathFrom, useFinishSignIn } from './returnPath';

export function SignUpForm({ onSignIn }: { onSignIn(): void }) {
  const { t } = useTranslation('auth');
  const { t: tr } = useTranslation('register');
  const { lang } = useLang();
  const finish = useFinishSignIn();
  const continuePath = returnPathFrom(useLocation().state) ?? '/';
  const [account, setAccount] = useState<AccountDraft>(emptyAccount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: 'email' | 'password' | null; message: string } | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await registerApi.createAccount(account.email.trim(), account.password, account.adminName.trim());
    } catch (err) {
      const failed = accountCreateError(err);
      setError(failed ? { field: failed.field, message: tr(`errors.${failed.key}`) } : { field: null, message: t('signUp.failed') });
      setBusy(false);
      return;
    }
    await sendAuthEmail({ kind: 'verify', lang, continuePath }).catch(() => undefined);
    setBusy(false);
    setVerifying(true);
  }

  if (verifying) return <VerifyEmailGate email={account.email.trim()} purpose="signUp" continuePath={continuePath} onConfirmed={finish} />;

  return (
    <>
      <StepAccount
        mode="signUp"
        value={account}
        onChange={setAccount}
        signedIn={false}
        busy={busy}
        error={error}
        onSubmit={() => void submit()}
      />
      <p className="mb-0 mt-5 text-center text-sm text-ink-muted">
        {t('signUp.haveAccount')}{' '}
        <Button variant="link" onClick={onSignIn} className="font-semibold underline">
          {t('signUp.signIn')}
        </Button>
      </p>
    </>
  );
}
