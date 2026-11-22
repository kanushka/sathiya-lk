// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { APIRoute } from 'astro';
import { robotsTxt } from '../lib/seo';
import { SITE_URL } from '../site';

export const GET: APIRoute = () => new Response(robotsTxt(SITE_URL), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
