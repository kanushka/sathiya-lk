// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

export const pageTitle = (siteName: string, page?: string): string => (page ? `${page} · ${siteName}` : siteName);

export function useDocumentTitle(page?: string) {
  const { t } = useTranslation('common');
  const siteName = t('brand.name');
  useEffect(() => {
    document.title = pageTitle(siteName, page);
    return () => {
      document.title = siteName;
    };
  }, [siteName, page]);
}
