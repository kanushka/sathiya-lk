// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

const fromEnv = (name: string, fallback: string): string => (process.env[name]?.trim() || fallback).replace(/\/+$/, '');

export const SITE_URL = fromEnv('PUBLIC_SITE_URL', 'https://sathiya.kanushka.com');
export const APP_URL = fromEnv('PUBLIC_APP_URL', 'https://app.sathiya.kanushka.com');
export const CONTACT_EMAIL = 'sathiya@kanushka.com';

export const SITE_HOST = new URL(SITE_URL).host;
