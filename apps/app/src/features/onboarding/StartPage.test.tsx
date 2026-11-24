// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderAuth } from '../auth/testHarness';
import { joinPathFrom, StartPage } from './StartPage';

vi.mock('../auth/api');

describe('joinPathFrom', () => {
  it.each([
    ['https://sathiya.kanushka.com/join/s1/abc123', '/join/s1/abc123'],
    ['  https://staging.example.lk/join/t/tok_-9  ', '/join/t/tok_-9'],
    ['/join/s1/abc123', '/join/s1/abc123'],
    ['sathiya.kanushka.com/join/s1/abc123', '/join/s1/abc123'],
    ['https://sathiya.kanushka.com/join/s1/abc123?x=1#y', '/join/s1/abc123'],
  ])('%s → %s', (input, path) => {
    expect(joinPathFrom(input)).toBe(path);
  });

  it.each(['', 'hello', 'https://evil.example/login', '/join/', '/join/s1', '/join/s1/abc/extra', 'javascript:alert(1)'])('rejects %j', (input) => {
    expect(joinPathFrom(input)).toBeNull();
  });
});

describe('StartPage', () => {
  it('offers to register a school', () => {
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true });
    expect(screen.getByRole('link', { name: 'Register a school' })).toHaveAttribute('href', '/register');
  });

  it('opens a pasted invite link', async () => {
    const user = userEvent.setup();
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true });
    await user.type(screen.getByLabelText('Invite link'), 'https://sathiya.kanushka.com/join/s1/abc123');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/join/s1/abc123');
  });

  it('says when the pasted text is not an invite link', async () => {
    const user = userEvent.setup();
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true });
    await user.type(screen.getByLabelText('Invite link'), 'hello');
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText("That doesn't look like a Sathiya invite link.")).toBeInTheDocument();
    expect(screen.queryByTestId('where')).not.toBeInTheDocument();
  });

  it('refreshes claims once on mount', async () => {
    const refreshClaims = vi.fn(async () => undefined);
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true, refreshClaims });
    await waitFor(() => expect(refreshClaims).toHaveBeenCalledTimes(1));
  });

  it('says "not part of a school yet" only to signed-in users without schools', () => {
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true });
    expect(screen.getByText("You're signed in but not part of a school yet.")).toBeInTheDocument();
  });

  it('hides that line for members', () => {
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true, claims: { schools: { s1: { r: 'a' } } } });
    expect(screen.queryByText("You're signed in but not part of a school yet.")).not.toBeInTheDocument();
  });

  it('hides that line for signed-out visitors', () => {
    renderAuth(<StartPage />, { route: '/start', at: '/start' });
    expect(screen.queryByText("You're signed in but not part of a school yet.")).not.toBeInTheDocument();
  });

  it('shows who is signed in', () => {
    renderAuth(<StartPage />, { route: '/start', at: '/start', signedIn: true });
    expect(screen.getByText('Signed in as a@b.lk')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
