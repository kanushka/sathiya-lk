// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { padCensusNo, pickName, type MoeSchool } from '@sathiya/core';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { cx } from '../../ui/cx';
import { useToast } from '../../ui/Toast';
import { BrandLockup, LanguageToggle } from '../auth/AuthChrome';
import { useDocumentTitle } from '../../lib/brand';
import { sendAuthEmail } from '../auth/authEmail';
import { ReportSchoolModal } from '../auth/ReportSchoolModal';
import { StepAccount } from './StepAccount';
import { StepBrand } from './StepBrand';
import { CensusEntry, ConfirmSchool } from './StepCensus';
import { StepSchool } from './StepSchool';
import { VerifyEmailGate } from './VerifyEmailGate';
import { accountCreateError, isUnverifiedPasswordUser, registerFailure } from './errors';
import * as api from './api';
import { defaultBrand, emptyAccount, emptySchool, gradeList, listedDraft, type AccountDraft, type BrandDraft, type SchoolDraft } from './model';
import { toApiError } from '../../lib/callable';

type Step = 1 | 2 | 3;
type Mode = 'entry' | 'listed' | 'registered' | 'unlisted';
const steps = ['school', 'brand', 'account'] as const;

export function RegisterPage() {
  const { t } = useTranslation('register');
  const { t: ta } = useTranslation('auth');
  useDocumentTitle(ta('pageTitle.register'));
  const { user, refreshClaims } = useAuth();
  const { lang } = useLang();
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState<Step>(1);
  const [school, setSchool] = useState<SchoolDraft>(emptySchool);
  const [brand, setBrand] = useState<BrandDraft>(defaultBrand);
  const [account, setAccount] = useState<AccountDraft>({ ...emptyAccount, adminName: user?.displayName ?? '' });
  const [busy, setBusy] = useState(false);
  const accountCreated = useRef(false);
  const [error, setError] = useState<{ field: 'email' | 'password' | null; message: string } | null>(null);
  const [gate, setGate] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [censusTaken, setCensusTaken] = useState<{ schoolId?: string } | null>(null);
  const [reporting, setReporting] = useState(false);
  const [checking, setChecking] = useState(false);
  const needsGate = gate || (!confirmed && isUnverifiedPasswordUser(user));
  const draftVersion = useRef(0);
  const [mode, setMode] = useState<Mode>('entry');
  const [census, setCensus] = useState('');
  const [moe, setMoe] = useState<MoeSchool | null>(null);
  const [looking, setLooking] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [notListedCensus, setNotListedCensus] = useState('');
  const lookupVersion = useRef(0);
  const sectionRef = useRef<HTMLDivElement>(null);
  const firstRender = useRef(true);
  const keepFocus = useRef(false);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (keepFocus.current) {
      keepFocus.current = false;
      return;
    }
    sectionRef.current?.querySelector<HTMLElement>('h2')?.focus();
  }, [step, mode, needsGate]);

  function showListed(found: MoeSchool) {
    draftVersion.current++;
    setMoe(found);
    setSchool((prev) => listedDraft(found, prev));
    setCensusTaken(null);
    setMode('listed');
  }

  function toEntry() {
    lookupVersion.current++;
    setLooking(false);
    setLookupError(null);
    setCensusTaken(null);
    setMode('entry');
  }

  function toUnlisted(censusNo: string) {
    lookupVersion.current++;
    setLooking(false);
    setLookupError(null);
    draftVersion.current++;
    setCensusTaken(null);
    setNotListedCensus(censusNo);
    setMoe(null);
    setSchool((prev) => ({
      ...(moe ? emptySchool : prev),
      censusNo,
      noCensus: false,
      ...(censusNo ? { type: 'government' as const } : {}),
    }));
    setMode('unlisted');
  }

  async function find() {
    const c = census.trim();
    if (c === '') return setLookupError(t('census.empty'));
    if (!/^\d{1,6}$/.test(c)) return setLookupError(t('census.format'));
    const version = ++lookupVersion.current;
    setLookupError(null);
    setLooking(true);
    try {
      const res = await api.lookupCensus(padCensusNo(c));
      if (version !== lookupVersion.current) return;
      if (res.status === 'listed') showListed(res.school);
      else if (res.status === 'registered') {
        setCensusTaken({});
        setMode('registered');
      } else toUnlisted(padCensusNo(c));
    } catch (err) {
      if (version !== lookupVersion.current) return;
      setLookupError(t(toApiError(err).code === 'rate-limited' ? 'errors.rateLimited' : 'census.lookupFailed'));
    } finally {
      if (version === lookupVersion.current) setLooking(false);
    }
  }

  function editSchool(next: SchoolDraft) {
    draftVersion.current++;
    setChecking(false);
    if (next.censusNo !== school.censusNo || next.type !== school.type) setCensusTaken(null);
    setSchool(next);
  }

  async function nextFromSchool() {
    const census = school.type !== 'government' && school.noCensus ? '' : school.censusNo;
    if (census === '' || census === notListedCensus) {
      setStep(2);
      return;
    }
    setChecking(true);
    const version = draftVersion.current;
    let found: Awaited<ReturnType<typeof api.lookupCensus>> = { status: 'unlisted' };
    try {
      found = await api.lookupCensus(padCensusNo(census));
    } catch {
      found = { status: 'unlisted' };
    }
    if (version !== draftVersion.current) return;
    setChecking(false);
    if (found.status === 'registered') setCensusTaken({});
    else if (found.status === 'listed') showListed(found.school);
    else setStep(2);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (!user && !accountCreated.current) {
        await api.createAccount(account.email.trim(), account.password, account.adminName.trim());
        accountCreated.current = true;
        await sendAuthEmail({ kind: 'verify', lang }).catch(() => undefined);
        setConfirmed(false);
        setGate(true);
        setBusy(false);
        return;
      }
    } catch (err) {
      const failed = accountCreateError(err);
      setError(failed ? { field: failed.field, message: t(`errors.${failed.key}`) } : { field: null, message: t('errors.generic') });
      setBusy(false);
      return;
    }

    let schoolId: string;
    try {
      const termsVersion = await api.currentTermsVersion();
      schoolId = await api.registerSchool({
        school: {
          type: school.type,
          ...(school.type !== 'government' && school.noCensus ? {} : { censusNo: school.censusNo }),
          nameEn: school.nameEn.trim(),
          ...(school.nameSi.trim() ? { nameSi: school.nameSi.trim() } : {}),
          district: school.district.trim(),
          city: school.city.trim(),
          ...(school.address.trim() ? { address: school.address.trim() } : {}),
          ...(school.phone.trim() ? { phone: school.phone.trim() } : {}),
          grades: gradeList(school),
          ...(school.medium.length ? { medium: school.medium } : {}),
          staffPrefix: school.staffPrefix,
          colors: { primary: brand.primary.toUpperCase(), second: brand.second.toUpperCase() },
          termsVersion,
        },
        adminName: account.adminName.trim(),
        acceptedTermsVersion: termsVersion,
      });
    } catch (err) {
      const failure = registerFailure(err);
      if (failure?.code === 'school-registered') {
        setCensusTaken(failure.schoolId ? { schoolId: failure.schoolId } : {});
        if (mode === 'listed') {
          setCensus(school.censusNo);
          setMode('registered');
        }
        setStep(1);
      } else if (failure?.code === 'email-unverified') {
        setConfirmed(false);
        setGate(true);
      } else if (failure?.code === 'terms-outdated') {
        setAccount((a) => ({ ...a, terms: false }));
        setError({ field: null, message: t('errors.termsOutdated') });
      } else if (failure) {
        setError({ field: null, message: t(`errors.${failure.code === 'rate-limited' ? 'rateLimited' : 'tooManySchools'}`) });
      } else {
        setError({ field: null, message: t('errors.generic') });
      }
      setBusy(false);
      return;
    }

    await refreshClaims().catch(() => undefined);
    if (brand.logo) {
      try {
        await api.uploadLogo(schoolId, brand.logo);
      } catch {
        toast.show(t('errors.logoUpload'), 'error');
      }
    }
    navigate(`/s/${schoolId}/admin`, { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-[1040px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <BrandLockup layout="inline" />
          <ol aria-label={t('steps.label')} className="m-0 flex list-none flex-wrap gap-2 p-0 text-sm font-semibold">
            {steps.map((key, i) => {
              const n = i + 1;
              const done = step > n;
              const current = step === n;
              return (
                <li
                  key={key}
                  aria-current={current ? 'step' : undefined}
                  className={cx(
                    'rounded-full px-3.5 py-2',
                    current && 'bg-teal text-white',
                    done && 'bg-[#E3F1F0] text-teal',
                    !current && !done && 'border border-line bg-white text-ink-muted',
                  )}
                >
                  {done ? '✓ ' : ''}
                  {n} {t(`steps.${key}`)}
                </li>
              );
            })}
          </ol>
        </div>
        <div ref={sectionRef}>
          {needsGate && (
            <VerifyEmailGate
              email={user?.email ?? account.email}
              onConfirmed={() => {
                setGate(false);
                setConfirmed(true);
              }}
            />
          )}
          {!needsGate && step === 1 && (mode === 'entry' || mode === 'registered') && (
            <CensusEntry
              census={census}
              onCensus={(v) => {
                lookupVersion.current++;
                setLooking(false);
                setLookupError(null);
                setCensus(v);
                if (mode === 'registered') {
                  keepFocus.current = true;
                  toEntry();
                }
              }}
              onFind={() => void find()}
              onNotListed={() => toUnlisted('')}
              looking={looking}
              error={lookupError}
              taken={mode === 'registered'}
              onReport={() => setReporting(true)}
              onTryAnother={toEntry}
            />
          )}
          {!needsGate && step === 1 && mode === 'listed' && moe && (
            <ConfirmSchool moe={moe} value={school} onChange={editSchool} onNotMine={toEntry} onNext={() => setStep(2)} />
          )}
          {!needsGate && step === 1 && mode === 'unlisted' && (
            <StepSchool
              value={school}
              onChange={editSchool}
              onNext={() => void nextFromSchool()}
              checking={checking}
              censusTaken={!!censusTaken}
              onReport={() => setReporting(true)}
              onBack={toEntry}
              notListedCensus={notListedCensus}
            />
          )}
          {!needsGate && step === 2 && (
            <StepBrand
              schoolName={pickName(school, 'en')}
              schoolNameSi={school.nameSi}
              value={brand}
              onChange={setBrand}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}
          {!needsGate && step === 3 && (
            <StepAccount
              value={account}
              onChange={setAccount}
              signedIn={!!user}
              signedInEmail={user?.email}
              busy={busy}
              error={error}
              onBack={() => setStep(2)}
              onSubmit={() => void submit()}
            />
          )}
        </div>
        <ReportSchoolModal open={reporting} onClose={() => setReporting(false)} initialSchoolId={censusTaken?.schoolId} />
        <div className="mt-8 text-center">
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
