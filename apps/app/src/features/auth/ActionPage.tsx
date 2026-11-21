// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useSearchParams } from 'react-router-dom';
import { InvalidLinkView, RecoverEmailView, VerifyEmailView } from './ActionViews';
import { ResetPasswordView } from './ResetPasswordView';

export function ActionPage() {
  const [params] = useSearchParams();
  const mode = params.get('mode');
  const code = params.get('oobCode');
  if (!code) return <InvalidLinkView />;
  switch (mode) {
    case 'verifyEmail':
      return <VerifyEmailView code={code} />;
    case 'resetPassword':
      return <ResetPasswordView code={code} />;
    case 'recoverEmail':
      return <RecoverEmailView code={code} />;
    default:
      return <InvalidLinkView />;
  }
}
