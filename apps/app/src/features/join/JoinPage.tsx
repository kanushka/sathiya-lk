// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName, teacherIdOf, type ApiErrorCode, type JoinSchoolRes } from '@sathiya/core';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { useRefreshClaimsOnce } from '../../app/useRefreshClaimsOnce';
import { useDocumentTitle } from '../../lib/brand';
import { toApiError } from '../../lib/callable';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { LinkButton } from '../../ui/LinkButton';
import { LoadingState } from '../../ui/LoadingState';
import { getDirectorySchool } from '../auth/api';
import { BrandLockup, LanguageToggle } from '../auth/AuthChrome';
import { isUnverifiedPasswordUser } from '../register/errors';
import { VerifyEmailGate } from '../register/VerifyEmailGate';
import * as api from './api';

type ErrorCode = Extract<ApiErrorCode, 'link-invalid' | 'already-linked' | 'too-many-schools' | 'rate-limited' | 'not-allowed'> | 'generic';
type View = { kind: 'working' } | { kind: 'staffId' } | { kind: 'pending' } | { kind: 'error'; code: ErrorCode };

const shownCodes: readonly ErrorCode[] = ['link-invalid', 'already-linked', 'too-many-schools', 'rate-limited', 'not-allowed'];

function readError(err: unknown): { code: ApiErrorCode; fromServer: boolean } {
  const e = toApiError(err);
  return { code: e.code, fromServer: (e.details as { code?: unknown } | undefined)?.code === e.code };
}

function errorCode(err: unknown): ErrorCode {
  const { code, fromServer } = readError(err);
  return fromServer && (shownCodes as readonly string[]).includes(code) ? (code as ErrorCode) : 'generic';
}

function useSchoolName(sid: string | undefined): string | null {
  const { lang } = useLang();
  const [school, setSchool] = useState<{ nameEn: string; nameSi?: string } | null>(null);
  useEffect(() => {
    if (!sid) return;
    let live = true;
    getDirectorySchool(sid).then(
      (s) => live && setSchool(s),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [sid]);
  return school ? pickName(school, lang) : null;
}

export function JoinPage() {
  const { t } = useTranslation('join');
  useDocumentTitle(t('title'));
  const { sid, token = '' } = useParams();
  const { user, loading, signOut } = useAuth();
  const location = useLocation();
  const [verified, setVerified] = useState(false);
  const schoolName = useSchoolName(sid);

  if (loading) return <LoadingState />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-10 sm:py-12">
      <div className="mb-7">
        <BrandLockup />
      </div>
      <div className="w-full max-w-[520px]">
        <h1 className="mb-1 mt-0 text-[26px] font-bold">{t('title')}</h1>
        <p className="mb-6 mt-0 min-h-5 text-sm font-semibold text-ink-soft">{schoolName}</p>
        {isUnverifiedPasswordUser(user) && !verified ? (
          <VerifyEmailGate email={user.email} purpose="signUp" onConfirmed={() => setVerified(true)} />
        ) : (
          <JoinFlow sid={sid} token={token} />
        )}
        <p className="mb-0 mt-6 text-center text-sm text-ink-muted">
          {t('signedInAs', { email: user.email ?? '' })}{' '}
          <Button variant="link" onClick={() => void signOut()} className="underline">
            {t('signOut')}
          </Button>
        </p>
      </div>
      <div className="mt-8">
        <LanguageToggle />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <h2 className="mb-1 mt-0 text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function JoinFlow({ sid, token }: { sid?: string; token: string }) {
  const { t } = useTranslation('join');
  const { claims, refreshClaims } = useAuth();
  const navigate = useNavigate();
  const already = sid ? teacherIdOf(claims, sid) : undefined;
  const [view, setView] = useState<View>({ kind: 'working' });
  const started = useRef(false);
  const refreshed = useRefreshClaimsOnce(true);

  const finish = useCallback(
    async (res: JoinSchoolRes) => {
      if (res.status === 'pending') {
        setView({ kind: 'pending' });
        return;
      }
      try {
        await refreshClaims();
      } catch {
        // Linked on the server; the teacher route refreshes claims again if needed.
      }
      navigate(`/s/${res.schoolId}/me`, { replace: true });
    },
    [refreshClaims, navigate],
  );

  const attempt = useCallback(async () => {
    setView({ kind: 'working' });
    try {
      await finish(await api.joinSchool({ sid, token }));
    } catch (err) {
      const { code, fromServer } = readError(err);
      if (sid && fromServer && code === 'invalid') setView({ kind: 'staffId' });
      else setView({ kind: 'error', code: errorCode(err) });
    }
  }, [finish, sid, token]);

  useEffect(() => {
    if (!refreshed || already || started.current) return;
    started.current = true;
    void attempt();
  }, [refreshed, already, attempt]);

  if (already && sid) {
    return (
      <Card title={t('already.title')}>
        <p className="mb-4 mt-0 text-sm text-ink-muted">{t('already.body')}</p>
        <LinkButton to={`/s/${sid}/me`}>{t('already.open')}</LinkButton>
      </Card>
    );
  }

  switch (view.kind) {
    case 'working':
      return <LoadingState />;
    case 'pending':
      return (
        <Card title={t('pending.title')}>
          <p className="m-0 text-sm text-ink-muted">{t('pending.body')}</p>
        </Card>
      );
    case 'staffId':
      return <StaffIdForm onSubmit={(staffId) => api.joinSchool({ sid, token }, staffId)} onDone={finish} onError={(code) => setView({ kind: 'error', code })} />;
    case 'error':
      return <JoinError code={view.code} onRetry={() => void attempt()} />;
  }
}

function JoinError({ code, onRetry }: { code: ErrorCode; onRetry: () => void }) {
  const { t } = useTranslation('join');
  const content: Record<ErrorCode, { title: string; body: string }> = {
    'link-invalid': { title: t('errors.linkInvalidTitle'), body: t('errors.linkInvalid') },
    'already-linked': { title: t('errors.alreadyLinkedTitle'), body: t('errors.alreadyLinked') },
    'too-many-schools': { title: t('errors.cantJoinTitle'), body: t('errors.tooManySchools') },
    'rate-limited': { title: t('errors.cantJoinTitle'), body: t('errors.rateLimited') },
    'not-allowed': { title: t('errors.cantJoinTitle'), body: t('errors.notAllowed') },
    generic: { title: t('errors.genericTitle'), body: t('errors.generic') },
  };
  const { title, body } = content[code];
  return (
    <Card title={title}>
      <p role="alert" className="mb-4 mt-0 text-sm text-ink-muted">
        {body}
      </p>
      {code === 'generic' ? (
        <Button variant="primary" onClick={onRetry}>
          {t('errors.retry')}
        </Button>
      ) : (
        <LinkButton to="/start">{t('errors.home')}</LinkButton>
      )}
    </Card>
  );
}

function StaffIdForm({
  onSubmit,
  onDone,
  onError,
}: {
  onSubmit: (staffId: string) => Promise<JoinSchoolRes>;
  onDone: (res: JoinSchoolRes) => Promise<void>;
  onError: (code: ErrorCode) => void;
}) {
  const { t } = useTranslation('join');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const staffId = value.trim().toUpperCase();
    if (!staffId) {
      setError(t('staffId.required'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onDone(await onSubmit(staffId));
    } catch (err) {
      const { code, fromServer } = readError(err);
      if (fromServer && code === 'staff-id-unknown') setError(t('staffId.unknown'));
      else if (fromServer && code === 'already-linked') setError(t('staffId.taken'));
      else onError(errorCode(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={t('staffId.title')}>
      <p className="mb-4 mt-0 text-sm text-ink-muted">{t('staffId.body')}</p>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field label={t('staffId.label')} error={error}>
          <input
            className={`${inputClass} font-mono uppercase`}
            autoComplete="off"
            autoCapitalize="characters"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <Button type="submit" variant="primary" className="self-start" loading={busy} loadingLabel={t('staffId.sending')}>
          {t('staffId.submit')}
        </Button>
        <p className="m-0 text-xs text-ink-muted">{t('staffId.hint')}</p>
      </form>
    </Card>
  );
}
