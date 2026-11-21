// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export const DEFAULT_WEB_URL = 'https://sathiya.kanushka.com';

export function webUrl(path: string, base: string | undefined = import.meta.env.VITE_WEB_URL): string {
  return (base || DEFAULT_WEB_URL).replace(/\/+$/, '') + path;
}
