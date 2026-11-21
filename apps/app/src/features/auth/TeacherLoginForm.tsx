// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { syntheticEmail } from '@sathiya/core';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { SchoolSearch } from './SchoolSearch';
import { getDirectorySchool, signInWithPassword, type DirectorySchool } from './api';
import { authErrorMessage } from './errors';
import { readRememberedSchool, rememberSchool } from './schoolMemory';

export function TeacherLoginForm({ focus }: { focus?: boolean }) {
  const { t } = useTranslation('auth');
  const { refreshClaims } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const schoolParam = params.get('school');
  const [school, setSchool] = useState<DirectorySchool | null>(() => (schoolParam ? null : readRememberedSchool()));
  const [staffId, setStaffId] = useState('');
  const [password, setPassword] = useState('');
  const [schoolError, setSchoolError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!schoolParam) return;
    let live = true;
    void getDirectorySchool(schoolParam)
      .then((s) => {
        if (live && s) {
          setSchool(s);
          rememberSchool(s);
        }
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [schoolParam]);

  useEffect(() => {
    if (focus) searchRef.current?.focus();
  }, [focus]);

  function choose(s: DirectorySchool | null) {
    setSchool(s);
    setSchoolError(false);
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
    navigate('/', { replace: true });
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="w-full max-w-[460px] flex-1 basis-[400px] rounded-2xl border border-line bg-white p-5 sm:p-8"
    >
      <p className="m-0 text-[13px] font-bold uppercase tracking-[.06em] text-[#8A5300]">{t('teacher.eyebrow')}</p>
      <h1 className="mb-1 mt-1.5 text-[26px] font-bold">{t('teacher.title')}</h1>
      <p lang="si" className="mb-6 text-ink-muted font-[family-name:'Noto_Sans_Sinhala',Inter,sans-serif]">
        {t('teacher.titleSi')}
      </p>
      <div className="mb-[18px]">
        <Field
          label={t('teacher.school')}
          hint={t('teacher.schoolHint')}
          error={schoolError ? t('teacher.chooseSchool') : undefined}
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
      <Button type="submit" variant="primary" size="lg" className="w-full" disabled={busy || !staffId || !password}>
        {t('teacher.submit')}
      </Button>
      <p className="mb-0 mt-[18px] rounded-[10px] bg-[#F6F7F9] px-3.5 py-3 text-sm leading-normal text-ink-soft">
        {t('teacher.forgot')}
      </p>
    </form>
  );
}
