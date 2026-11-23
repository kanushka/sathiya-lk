// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useEffect } from 'react';

export const SITE_NAME = 'Sathiya (සතිය)';

export const pageTitle = (page?: string): string => (page ? `${page} · ${SITE_NAME}` : SITE_NAME);

export function useDocumentTitle(page?: string) {
  useEffect(() => {
    document.title = pageTitle(page);
    return () => {
      document.title = SITE_NAME;
    };
  }, [page]);
}
