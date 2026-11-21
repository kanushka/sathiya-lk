import type { Lang } from '@sathiya/core';
import { createI18n } from '@sathiya/i18n';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import { db } from '../lib/firebase';
import { useAuth } from './AuthProvider';

const storageKey = 'sathiya.lang';

export interface LangState {
  lang: Lang;
  setLang(l: Lang): void;
}

const LangCtx = createContext<LangState | null>(null);

function isLang(v: unknown): v is Lang {
  return v === 'en' || v === 'si';
}

function readStored(): Lang | null {
  try {
    const v = localStorage.getItem(storageKey);
    return isLang(v) ? v : null;
  } catch {
    return null;
  }
}

function store(lang: Lang): void {
  try {
    localStorage.setItem(storageKey, lang);
  } catch {
    // storage may be unavailable (private mode); the in-memory choice still applies
  }
}

export function initialLang(): Lang {
  const stored = readStored();
  if (stored) return stored;
  return typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('si') ? 'si' : 'en';
}

export function LangProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [i18n] = useState(() => createI18n(lang));
  const uid = user?.uid ?? null;

  useEffect(() => {
    void i18n.changeLanguage(lang);
    document.documentElement.lang = lang;
  }, [i18n, lang]);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    getDoc(doc(db, 'users', uid))
      .then((snap) => {
        const saved: unknown = snap.data()?.lang;
        if (!cancelled && isLang(saved)) {
          setLangState(saved);
          store(saved);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      store(next);
      if (uid) void setDoc(doc(db, 'users', uid), { lang: next }, { merge: true }).catch(() => undefined);
    },
    [uid],
  );

  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return (
    <LangCtx.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LangCtx.Provider>
  );
}

export function useMaybeLang(): LangState | null {
  return useContext(LangCtx);
}

export function useLang(): LangState {
  const ctx = useContext(LangCtx);
  if (!ctx) throw new Error('useLang must be used inside LangProvider');
  return ctx;
}
