// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from './Alert';
import { Button } from './Button';
import { Modal } from './Modal';

export const PHONE_QUERY = '(max-width: 767.98px)';
export const PHONE_NOTICE_KEY = 'sathiya.phoneNotice.dismissed';

function mediaQuery(query: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const mql = mediaQuery(query);
      mql?.addEventListener('change', notify);
      return () => mql?.removeEventListener('change', notify);
    },
    () => mediaQuery(query)?.matches ?? false,
    () => false,
  );
}

// The admin shell is 1024px wide, so Android Chrome zooms the page out to fit it.
// Scale the notice back up so it reads at its normal size.
function fitScale(): number {
  const ideal = document.documentElement.clientWidth;
  if (!ideal) return 1;
  return Math.min(4, Math.max(1, window.innerWidth / ideal));
}

function useFitScale(active: boolean): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    if (!active) return;
    const update = () => setScale(fitScale());
    update();
    const frame = requestAnimationFrame(update);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [active]);
  return scale;
}

function readDismissed(): boolean {
  try {
    return localStorage.getItem(PHONE_NOTICE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    localStorage.setItem(PHONE_NOTICE_KEY, '1');
  } catch {
    // Storage blocked: the notice is dismissed for this page view only.
  }
}

export function PhoneNotice() {
  const { t } = useTranslation('shell');
  const isPhone = useMediaQuery(PHONE_QUERY);
  const [dismissed, setDismissed] = useState(readDismissed);
  const scale = useFitScale(isPhone);

  if (!isPhone) return null;

  if (dismissed) {
    return (
      <div style={scale !== 1 ? { zoom: scale, width: window.innerWidth / scale } : undefined}>
        <Alert tone="info" className="rounded-none border-x-0 border-t-0 px-4 py-2 text-[13px] font-medium">
          {t('phoneNotice.banner')}
        </Alert>
      </div>
    );
  }

  const dismiss = () => {
    writeDismissed();
    setDismissed(true);
  };

  return (
    <Modal
      open
      title={t('phoneNotice.title')}
      onClose={dismiss}
      width={420}
      zoom={scale}
      footer={
        <Button variant="primary" onClick={dismiss}>
          {t('phoneNotice.continue')}
        </Button>
      }
    >
      <p className="m-0 text-sm leading-relaxed text-ink-soft">{t('phoneNotice.body')}</p>
    </Modal>
  );
}
