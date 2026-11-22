// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { APIRoute } from 'astro';
import { sitemapXml } from '../lib/seo';
import { SITE_URL } from '../site';

export const GET: APIRoute = () =>
  new Response(sitemapXml(SITE_URL), { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
