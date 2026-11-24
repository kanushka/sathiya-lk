// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { BRAND_NAME, type Email } from './layout';

export const siteFooter = (webUrl?: string): Email['footer'] => ({
  en: `${BRAND_NAME}: free school timetables for Sri Lanka`,
  linkUrl: webUrl,
  linkLabel: webUrl ? webUrl.replace(/^https?:\/\//, '').replace(/\/$/, '') : undefined,
});
