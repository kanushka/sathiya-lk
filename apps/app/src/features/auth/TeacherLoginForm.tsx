// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { syntheticEmail } from '@sathiya/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { recordSignIn } from '../teacher/signIn';
import { SchoolSearch } from './SchoolSearch';
import { getDirectorySchool, signInWithPassword, type DirectorySchool } from './api';
import { authErrorMessage } from './errors';
import { readRememberedSchool, rememberSchool } from './schoolMemory';

export function TeacherLoginForm({ autoFocus }: { autoFocus?: boolean }) {
  const { t } = useTranslation('auth');
  const { refreshClaims } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const schoolParam = params.get('school');
  const [school, setSchool] = useState<DirectorySchool | null>(() => (schoolParam ? null : readRememberedSchool()));
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [schoolError, setSchoolError] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const lookup = useRef(0);

  useEffect(() => {
    setUnknown(false);
    setSuspended(false);
    if (!schoolParam) return;
    setSchool(null);
    const id = ++lookup.current;
    void getDirectorySchool(schoolParam)
      .then((s) => {
        if (lookup.current !== id) return;
        if (!s) {
          setUnknown(true);
          return;
        }
        if (s.status === 'disabled') {
          setSuspended(true);
          return;
        }
        setSchool(s);
        rememberSchool(s);
      })
      .catch(() => undefined);
    return () => {
      lookup.current++;
    };
  }, [schoolParam]);

  useEffect(() => {
    if (autoFocus) searchRef.current?.focus();
  }, [autoFocus]);

  function choose(s: DirectorySchool | null) {
    lookup.current++;
    setSchool(s);
    setSchoolError(false);
    setSuspended(false);
    setUnknown(false);
    if (s) rememberSchool(s);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!school) {
      setSchoolError(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signInWithPassword(syntheticEmail(staffId.trim().toUpperCase(), school.id), password);
    } catch (err) {
      setError(authErrorMessage(err, t, 'errors.teacherCredentials'));
      setBusy(false);
      return;
    }
    try {
      await refreshClaims();
    } catch {
      // Signed in; HomeRedirect decides from whatever claims are loaded.
    }
    recordSignIn();
    navigate('/', { replace: true });
  }

  return (
    <form onSubmit={submit} noValidate>
      <h1 className="mb-1 mt-0 text-[26px] font-bold">{t('teacher.title')}</h1>
      <p lang="si" className="mb-6 text-ink-muted font-[family-name:'Noto_Sans_Sinhala',Inter,sans-serif]">
        {t('teacher.titleSi')}
      </p>
      <div className="mb-[18px]">
        <Field
          label={t('teacher.school')}
          hint={t('teacher.schoolHint')}
          error={
            suspended
              ? t('teacher.schoolSuspended')
              : unknown
                ? t('teacher.schoolUnknown')
                : schoolError
                  ? t('teacher.chooseSchool')
                  : undefined
          }
        >
          <SchoolSearch id="teacher-school" ref={searchRef} value={school} onChange={choose} />
        </Field>
      </div>
      <Field label={t('teacher.staffId')} className="mb-[18px]">
        <input
          className={`${inputClass} uppercase tracking-[.06em]`}
          autoComplete="username"
          autoCapitalize="characters"
          spellCheck={false}
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
        />
      </Field>
      <Field label={t('teacher.password')} hint={t('teacher.passwordHint')} error={error} className="mb-6">
        <input
          className={inputClass}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      <Button type="submit" variant="primary" size="lg" className="w-full" loading={busy} disabled={!staffId || !password}>
        {t('teacher.submit')}
      </Button>
      <p className="mb-0 mt-[18px] rounded-lg bg-surface-2 px-3.5 py-3 text-sm leading-normal text-ink-soft">
        {t('teacher.forgot')}
      </p>
    </form>
  );
}
