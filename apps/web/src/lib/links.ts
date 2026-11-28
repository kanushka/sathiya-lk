// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { en, type Content } from '../content/en';
import { si } from '../content/si';

export type Lang = 'en' | 'si';
export type Page = 'index' | 'terms' | 'privacy' | 'contact' | 'guide' | 'guide/register-school' | 'guide/subjects' | 'guide/grades' | 'guide/templates' | 'guide/teachers' | 'guide/timetable-class' | 'guide/profile' | 'guide/members' | 'guide/import' | 'guide/timetable-teacher' | 'guide/autofill' | 'guide/publish-print' | 'guide/teacher-phone' | '404';

import { APP_URL } from '../site';

export function appLinks(base: string = import.meta.env.PUBLIC_APP_URL || APP_URL) {
  const root = base.replace(/\/+$/, '');
  return {
    register: `${root}/register`,
    login: `${root}/login`,
    teacherLogin: `${root}/login`,
    report: `${root}/login?report=1`,
  };
}

export function pagePath(lang: Lang, page: Page): string {
  const prefix = lang === 'si' ? '/si/' : '/';
  return page === 'index' || page === '404' ? prefix : `${prefix}${page}/`;
}

export function sectionHref(lang: Lang, current: Page, id: string): string {
  return current === 'index' ? `#${id}` : `${pagePath(lang, 'index')}#${id}`;
}

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'si' : 'en');

export const content = (lang: Lang): Content => (lang === 'si' ? si : en);

export const LEGAL_VERSION = '2026-11-21';
