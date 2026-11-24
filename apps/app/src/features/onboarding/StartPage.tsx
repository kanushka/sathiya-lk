// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { schoolIds } from '@sathiya/core';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useRefreshClaimsOnce } from '../../app/useRefreshClaimsOnce';
import { useDocumentTitle } from '../../lib/brand';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { LinkButton } from '../../ui/LinkButton';
import { BrandLockup, LanguageToggle } from '../auth/AuthChrome';

const JOIN_PATH = /^\/join\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/?$/;

export function joinPathFrom(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  let pathname: string;
  try {
    const href = text.startsWith('/') ? `https://x${text}` : /^https?:\/\//i.test(text) ? text : `https://${text}`;
    pathname = new URL(href).pathname;
  } catch {
    return null;
  }
  return JOIN_PATH.test(pathname) ? pathname.replace(/\/$/, '') : null;
}

export function StartPage() {
  const { t } = useTranslation('auth');
  useDocumentTitle(t('start.title'));
  const { user, claims, signOut } = useAuth();
  useRefreshClaimsOnce(!!user);
  const noSchool = !!user && schoolIds(claims).length === 0;
  const navigate = useNavigate();
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);

  function join(e: FormEvent) {
    e.preventDefault();
    const path = joinPathFrom(link);
    if (!path) {
      setError(t('start.joinInvalid'));
      return;
    }
    navigate(path);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas px-4 py-10 sm:py-12">
      <div className="mb-7">
        <BrandLockup />
      </div>
      <div className="w-full max-w-[460px]">
        <h1 className={noSchool ? 'mb-1 mt-0 text-[26px] font-bold' : 'mb-6 mt-0 text-[26px] font-bold'}>{t('start.title')}</h1>
        {noSchool && <p className="mb-6 mt-0 text-sm text-ink-muted">{t('start.subtitle')}</p>}
        <section className="mb-4 rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="mb-1 mt-0 text-lg font-bold">{t('start.joinTitle')}</h2>
          <p className="mb-4 mt-0 text-sm text-ink-muted">{t('start.joinBody')}</p>
          <form onSubmit={join} noValidate className="flex flex-col gap-3">
            <Field label={t('start.joinLabel')} error={error}>
              <input
                className={inputClass}
                type="url"
                inputMode="url"
                autoComplete="off"
                value={link}
                onChange={(e) => {
                  setLink(e.target.value);
                  setError(null);
                }}
              />
            </Field>
            <Button type="submit" className="self-start">
              {t('start.join')}
            </Button>
          </form>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 sm:p-6">
          <h2 className="mb-1 mt-0 text-lg font-bold">{t('start.registerTitle')}</h2>
          <p className="mb-4 mt-0 text-sm text-ink-muted">{t('start.registerBody')}</p>
          <LinkButton to="/register">{t('start.register')}</LinkButton>
        </section>
        {user && (
          <p className="mb-0 mt-6 text-center text-sm text-ink-muted">
            {t('start.signedInAs', { email: user.email ?? '' })}{' '}
            <Button variant="link" onClick={() => void signOut()} className="underline">
              {t('start.signOut')}
            </Button>
          </p>
        )}
      </div>
      <div className="mt-8">
        <LanguageToggle />
      </div>
    </div>
  );
}
