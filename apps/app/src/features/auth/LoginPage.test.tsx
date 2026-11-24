// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as registerApi from '../register/api';
import * as api from './api';
import { sendAuthEmail } from './authEmail';
import { LoginPage } from './LoginPage';
import { renderAuth } from './testHarness';

vi.mock('./api');
vi.mock('./authEmail');
vi.mock('../register/api');

function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

const FACEBOOK_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/440.0.0.29.109]';

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.searchSchools).mockResolvedValue([]);
  vi.mocked(api.getDirectorySchool).mockResolvedValue(null);
  vi.mocked(api.signInWithPassword).mockResolvedValue(undefined);
  vi.mocked(api.signInWithGoogle).mockResolvedValue(undefined);
  vi.mocked(api.claimInvites).mockResolvedValue(undefined);
  vi.mocked(registerApi.createAccount).mockResolvedValue(undefined);
  vi.mocked(registerApi.confirmVerified).mockResolvedValue(true);
  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const card = () => within(screen.getByRole('heading', { name: 'Sign in' }).closest('form') as HTMLElement);

describe('report a school', () => {
  it('opens the report popup from the login page', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Report it' }));
    expect(screen.getByRole('dialog', { name: 'Report a school' })).toBeInTheDocument();
  });

  it('opens the report popup on load for /login?report=1', () => {
    renderAuth(<LoginPage />, { route: '/login?report=1' });
    expect(screen.getByRole('dialog', { name: 'Report a school' })).toBeInTheDocument();
  });

  it('does not open the report popup without the flag', () => {
    renderAuth(<LoginPage />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('single sign-in page', () => {
  it('has no admin / teacher switch and no staff ID login', () => {
    renderAuth(<LoginPage />, { route: '/login?as=teacher' });
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Staff ID')).not.toBeInTheDocument();
    expect(card().getByLabelText('Email')).toBeInTheDocument();
  });

  it('puts Google first with the Recommended tag, email and password below', () => {
    renderAuth(<LoginPage />);
    const google = card().getByRole('button', { name: /Continue with Google/ });
    expect(card().getByText('Recommended — quickest')).toBeInTheDocument();
    const email = card().getByLabelText('Email');
    expect(google.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

describe('in-app browser', () => {
  it('hides Google and offers to open the page in Chrome or Safari', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(FACEBOOK_UA);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderAuth(<LoginPage />);
    expect(screen.queryByRole('button', { name: /Continue with Google/ })).not.toBeInTheDocument();
    expect(screen.getByText('Open this page in Chrome or Safari')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText('Link copied')).toBeInTheDocument();
    expect(card().getByLabelText('Email')).toBeInTheDocument();
  });

  it('copies the page that asked for sign-in, not the login page', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(FACEBOOK_UA);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText');
    renderAuth(<LoginPage />, { from: '/join/x/y' });
    await user.click(screen.getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/join/x/y`);
  });

  it('shows Google in a normal browser', () => {
    renderAuth(<LoginPage />);
    expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeInTheDocument();
    expect(screen.queryByText('Open this page in Chrome or Safari')).not.toBeInTheDocument();
  });
});

describe('sign in', () => {
  it('claims invites, refreshes claims and routes to the school home', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    vi.mocked(api.claimInvites).mockImplementation(async () => void order.push('claim'));
    renderAuth(<LoginPage />, {
      signedIn: true,
      claimsAfterRefresh: { schools: { siripura: { r: 'a' } } },
      refreshClaims: async () => void order.push('refresh'),
    });
    await user.type(card().getByLabelText('Email'), 'principal@siripura.lk');
    await user.type(card().getByLabelText('Password'), 'secret12');
    await user.click(card().getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(api.signInWithPassword).toHaveBeenCalledWith('principal@siripura.lk', 'secret12'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/s/siripura/admin');
    expect(order).toEqual(['claim', 'refresh']);
  });

  it.each([
    [{ schools: { s1: { r: 't' as const, t: 'T1' } } }, '/s/s1/me'],
    [{ super: true }, '/super'],
    [{}, '/start'],
  ])('routes claims %j to %s', async (claims, path) => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: claims });
    await user.click(card().getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByTestId('where')).toHaveTextContent(path);
    expect(api.claimInvites).toHaveBeenCalled();
  });

  it('returns to the page that asked for sign-in', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, from: '/join/s1/tok' });
    await user.click(card().getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/join/s1/tok');
  });

  it('still routes when claimInvites fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.claimInvites).mockRejectedValue(new Error('boom'));
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: { schools: { s: { r: 'a' } } } });
    await user.click(card().getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/s/s/admin');
  });

  it('still navigates home when refreshClaims fails', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, {
      signedIn: true,
      claims: { schools: { s: { r: 'a' } } },
      refreshClaims: async () => {
        throw new Error('token');
      },
    });
    await user.click(card().getByRole('button', { name: /Continue with Google/ }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/s/s/admin');
  });

  it('shows wrong-credentials message and stays put', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithPassword).mockRejectedValue(authError('auth/wrong-password'));
    renderAuth(<LoginPage />);
    await user.type(card().getByLabelText('Email'), 'a@b.lk');
    await user.type(card().getByLabelText('Password'), 'nope');
    await user.click(card().getByRole('button', { name: 'Log in' }));
    expect(await card().findByRole('alert')).toHaveTextContent('Wrong email or password');
    expect(api.claimInvites).not.toHaveBeenCalled();
  });

  it('renders the four-colour Google logo', () => {
    renderAuth(<LoginPage />);
    const logo = within(screen.getByRole('button', { name: /Continue with Google/ })).getByTestId('google-logo');
    const fills = Array.from(logo.querySelectorAll('path')).map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#EA4335', '#4285F4', '#FBBC05', '#34A853']);
  });

  it('ignores a closed Google popup', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithGoogle).mockRejectedValue(authError('auth/popup-closed-by-user'));
    renderAuth(<LoginPage />);
    await user.click(card().getByRole('button', { name: /Continue with Google/ }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.claimInvites).not.toHaveBeenCalled();
  });
});

describe('create account', () => {
  it('creates an email account, shows the verify gate, then returns to the page that asked', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { from: '/join/s1/tok', signedIn: true });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Your name'), 'Nimal Perera');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(registerApi.createAccount).toHaveBeenCalledWith('nimal@siripura.lk', 'secret12', 'Nimal Perera');
    expect(sendAuthEmail).toHaveBeenCalledWith({ kind: 'verify', lang: 'en', continuePath: '/join/s1/tok' });
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: "I've confirmed it" }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/join/s1/tok');
    expect(api.claimInvites).toHaveBeenCalled();
  });

  it('goes home after verification when nothing asked for sign-in', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: { schools: { s1: { r: 'a' } } } });
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.click(await screen.findByRole('button', { name: "I've confirmed it" }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/s/s1/admin');
  });

  it('shows an email-in-use error and can go back to sign in', async () => {
    const user = userEvent.setup();
    vi.mocked(registerApi.createAccount).mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }));
    renderAuth(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(await screen.findByText('That email already has an account. Log in instead.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
});

describe('login form basics', () => {
  it('keeps Log in enabled and asks for missing details on submit', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    const submit = card().getByRole('button', { name: 'Log in' });
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(card().getByText('Enter your email and password.')).toBeInTheDocument();
    expect(api.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    const input = card().getByLabelText('Password');
    const toggle = card().getByRole('button', { name: 'Show password' });
    expect(input).toHaveAttribute('type', 'password');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows one language only', () => {
    renderAuth(<LoginPage />);
    expect(screen.queryByText('පිවිසෙන්න')).not.toBeInTheDocument();
  });
});

describe('brand logo', () => {
  it('links to the website home page', () => {
    renderAuth(<LoginPage />);
    expect(screen.getByRole('link', { name: /Sathiya/ })).toHaveAttribute('href', 'https://sathiya.kanushka.com/');
  });
});
