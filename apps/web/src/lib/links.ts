import { en, type Content } from '../content/en';
import { si } from '../content/si';

export type Lang = 'en' | 'si';
export type Page = 'index' | 'terms' | 'privacy' | 'contact';

export const DEFAULT_APP_URL = 'https://app.sathiya.lk';

export function appLinks(base: string = import.meta.env.PUBLIC_APP_URL || DEFAULT_APP_URL) {
  const root = base.replace(/\/+$/, '');
  return {
    register: `${root}/register`,
    login: `${root}/login`,
    teacherLogin: `${root}/login?as=teacher`,
  };
}

export function pagePath(lang: Lang, page: Page): string {
  const prefix = lang === 'si' ? '/si/' : '/';
  return page === 'index' ? prefix : `${prefix}${page}/`;
}

export function sectionHref(lang: Lang, current: Page, id: string): string {
  return current === 'index' ? `#${id}` : `${pagePath(lang, 'index')}#${id}`;
}

export const otherLang = (lang: Lang): Lang => (lang === 'en' ? 'si' : 'en');

export const content = (lang: Lang): Content => (lang === 'si' ? si : en);

export const LEGAL_VERSION = '2026-11-21';
