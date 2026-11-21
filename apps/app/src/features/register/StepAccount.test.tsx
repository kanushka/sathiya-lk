// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n, testI18n } from '../../test/render';
import { StepAccount, legalUrl } from './StepAccount';

const draft = { adminName: '', email: '', password: '', terms: false };

function renderStep() {
  renderWithI18n(<StepAccount value={draft} onChange={() => {}} signedIn={false} busy={false} onBack={() => {}} onSubmit={() => {}} />);
}

afterEach(async () => {
  vi.unstubAllEnvs();
  await testI18n.changeLanguage('en');
});

describe('legalUrl', () => {
  it('points at the English routes by default', () => {
    expect(legalUrl('terms', 'en')).toBe('https://sathiya.kanushka.com/terms/');
    expect(legalUrl('privacy', 'en')).toBe('https://sathiya.kanushka.com/privacy/');
  });

  it('points at the Sinhala routes', () => {
    expect(legalUrl('terms', 'si')).toBe('https://sathiya.kanushka.com/si/terms/');
    expect(legalUrl('privacy', 'si')).toBe('https://sathiya.kanushka.com/si/privacy/');
  });

  it('honours VITE_WEB_URL', () => {
    vi.stubEnv('VITE_WEB_URL', 'https://staging.example.com');
    expect(legalUrl('terms', 'en')).toBe('https://staging.example.com/terms/');
  });
});

describe('StepAccount links', () => {
  it('links to the site routes for the current language', async () => {
    renderStep();
    const hrefs = () => screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs()).toEqual(['https://sathiya.kanushka.com/terms/', 'https://sathiya.kanushka.com/privacy/']);
    await testI18n.changeLanguage('si');
    renderStep();
    expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toContain('https://sathiya.kanushka.com/si/terms/');
  });
});
