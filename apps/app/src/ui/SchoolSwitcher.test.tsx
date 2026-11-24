// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { Claims } from '@sathiya/core';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { pickOption } from '../test/pickOption';

const state = vi.hoisted(() => ({ claims: {} as Claims, names: vi.fn() }));
vi.mock('../app/AuthProvider', () => ({ useAuth: () => ({ user: { uid: 'u' }, claims: state.claims, loading: false }) }));
vi.mock('../app/memberSchools', () => ({ fetchSchoolNames: state.names }));

const { SchoolSwitcher } = await import('./SchoolSwitcher');

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function renderAt(current: string) {
  renderWithI18n(
    <MemoryRouter initialEntries={['/here']}>
      <Routes>
        <Route path="/here" element={<SchoolSwitcher current={current} />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  state.names.mockReset();
  state.names.mockImplementation(async (ids: string[]) =>
    Object.fromEntries(ids.map((id) => [id, { s1: 'Siripura Central College', s2: 'Royal College' }[id] ?? id])),
  );
});

describe('SchoolSwitcher', () => {
  it('is hidden for an account with one school', () => {
    state.claims = { schools: { s1: { r: 'a' } } };
    renderAt('s1');
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(state.names).not.toHaveBeenCalled();
  });

  it('lists every school with its role', async () => {
    state.claims = { schools: { s1: { r: 'a' }, s2: { r: 't', t: 'T2' } } };
    const user = userEvent.setup();
    renderAt('s1');
    const box = await screen.findByRole('combobox', { name: /^School/ });
    expect(await screen.findByText('Siripura Central College · Admin')).toBeInTheDocument();
    await user.click(box);
    expect(await screen.findByRole('option', { name: 'Royal College · Teacher' })).toBeInTheDocument();
  });

  it('navigates to the chosen school home', async () => {
    state.claims = { schools: { s1: { r: 'a' }, s2: { r: 't', t: 'T2' } } };
    const user = userEvent.setup();
    renderAt('s1');
    await screen.findByText('Siripura Central College · Admin');
    await pickOption(user, screen.getByRole('combobox', { name: /^School/ }), 'Royal College · Teacher');
    expect(await screen.findByTestId('where')).toHaveTextContent('/s/s2/me');
  });

  it('falls back to the school id when names cannot load', async () => {
    state.claims = { schools: { s1: { r: 'a' }, s2: { r: 'a' } } };
    state.names.mockRejectedValue(new Error('offline'));
    renderAt('s2');
    expect(await screen.findByText('s2 · Admin')).toBeInTheDocument();
  });
});
