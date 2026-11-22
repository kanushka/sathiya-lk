// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { useLang } from '../../app/LangProvider';
import { cx } from '../../ui/cx';
import { useToast } from '../../ui/Toast';
import { BrandMark, LanguageToggle } from '../auth/AuthChrome';
import { sendAuthEmail } from '../auth/authEmail';
import { ReportSchoolModal } from '../auth/ReportSchoolModal';
import { StepAccount } from './StepAccount';
import { StepBrand } from './StepBrand';
import { StepSchool } from './StepSchool';
import { VerifyEmailGate } from './VerifyEmailGate';
import { isUnverifiedPasswordUser, registerFailure } from './errors';
import * as api from './api';
import { defaultBrand, emptyAccount, emptySchool, gradeList, type AccountDraft, type BrandDraft, type SchoolDraft } from './model';

type Step = 1 | 2 | 3;
const steps = ['school', 'brand', 'account'] as const;

export function RegisterPage() {
  const { t } = useTranslation('register');
  const { t: ta } = useTranslation('auth');
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

  function editSchool(next: SchoolDraft) {
    draftVersion.current++;
    setChecking(false);
    if (next.censusNo !== school.censusNo || next.type !== school.type) setCensusTaken(null);
    setSchool(next);
  }

  async function nextFromSchool() {
    const census = school.type !== 'government' && school.noCensus ? '' : school.censusNo;
    if (census === '') {
      setStep(2);
      return;
    }
    setChecking(true);
    const version = draftVersion.current;
    let available = true;
    try {
      available = await api.censusAvailable(census);
    } catch {
      available = true;
    }
    if (version !== draftVersion.current) return;
    setChecking(false);
    if (available) setStep(2);
    else setCensusTaken({});
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
      const code = (err as { code?: string }).code;
      setError(
        code === 'auth/email-already-in-use'
          ? { field: 'email', message: t('errors.emailInUse') }
          : code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements'
            ? { field: 'password', message: t('errors.weakPassword') }
            : code === 'auth/invalid-email'
              ? { field: 'email', message: t('errors.invalidEmail') }
              : { field: null, message: t('errors.generic') },
      );
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
          staffPrefix: school.staffPrefix,
          colors: { primary: brand.primary.toUpperCase(), second: brand.second.toUpperCase() },
          termsVersion,
        },
        adminName: account.adminName.trim(),
        acceptedTermsVersion: termsVersion,
      });
    } catch (err) {
      const failure = registerFailure(err);
      if (failure?.code === 'census-taken') {
        setCensusTaken(failure.schoolId ? { schoolId: failure.schoolId } : {});
        setStep(1);
      } else if (failure?.code === 'email-unverified') {
        setConfirmed(false);
        setGate(true);
      } else if (failure) {
        setError({ field: null, message: t(`errors.${failure.code === 'rate-limited' ? 'rateLimited' : 'alreadyHasSchool'}`) });
      } else {
        setError({ field: null, message: t('errors.generic') });
      }
      setBusy(false);
      return;
    }

    let refreshed = true;
    try {
      await refreshClaims();
    } catch {
      refreshed = false;
    }
    if (brand.logo) {
      try {
        await api.uploadLogo(schoolId, brand.logo);
      } catch {
        toast.show(t('errors.logoUpload'), 'error');
      }
    }
    navigate(refreshed ? '/admin' : '/', { replace: true });
  }

  return (
    <div className="min-h-screen bg-canvas px-4 py-10">
      <div className="mx-auto max-w-[1040px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <span className="text-xl font-extrabold">{ta('brand')}</span>
          </div>
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
        {needsGate && (
          <VerifyEmailGate
            email={user?.email ?? account.email}
            onConfirmed={() => {
              setGate(false);
              setConfirmed(true);
            }}
          />
        )}
        {!needsGate && step === 1 && (
          <StepSchool
            value={school}
            onChange={editSchool}
            onNext={() => void nextFromSchool()}
            checking={checking}
            censusTaken={!!censusTaken}
            onReport={() => setReporting(true)}
          />
        )}
        {!needsGate && step === 2 && (
          <StepBrand
            schoolName={school.nameEn}
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
        <ReportSchoolModal open={reporting} onClose={() => setReporting(false)} initialSchoolId={censusTaken?.schoolId} />
        <div className="mt-8 text-center">
          <LanguageToggle />
        </div>
      </div>
    </div>
  );
}
