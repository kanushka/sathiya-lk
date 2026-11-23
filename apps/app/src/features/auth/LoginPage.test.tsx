// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Link } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from './api';
import { recordSignIn } from '../teacher/signIn';
import { LoginPage } from './LoginPage';
import { renderAuth } from './testHarness';

vi.mock('./api');
vi.mock('../teacher/signIn');

const siripura = { id: 'siripura', nameEn: 'Siripura Central College', district: 'Kandy', city: 'Peradeniya', status: 'active' as const };

function authError(code: string) {
  return Object.assign(new Error(code), { code });
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.searchSchools).mockResolvedValue([siripura]);
  vi.mocked(api.getDirectorySchool).mockResolvedValue(null);
  vi.mocked(api.signInWithPassword).mockResolvedValue(undefined);
  vi.mocked(api.signInWithGoogle).mockResolvedValue(undefined);
  vi.mocked(api.claimInvites).mockResolvedValue(undefined);
});

const AS_TEACHER = '/login?as=teacher';

const teacherCard = () => screen.getByRole('heading', { name: 'Teacher login' }).closest('form') as HTMLElement;

async function pickSchool(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('School'), 'siri');
  await user.click(await screen.findByRole('option', { name: /Siripura Central College/ }));
}

describe('school search labels', () => {
  it('shows "Name, City" on each result', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    await user.type(screen.getByLabelText('School'), 'siri');
    expect((await screen.findByRole('option')).textContent).toBe('Siripura Central College, Peradeniya');
  });

  it('omits the city when the directory doc has none', async () => {
    const user = userEvent.setup();
    const { city: _city, ...noCity } = siripura;
    vi.mocked(api.searchSchools).mockResolvedValue([noCity]);
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    await user.type(screen.getByLabelText('School'), 'siri');
    expect(await screen.findByRole('option', { name: 'Siripura Central College' })).toBeInTheDocument();
  });
});

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

  it('hints at an 8-character teacher password', () => {
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    expect(screen.getByText('The 8-character password on your login slip.')).toBeInTheDocument();
  });
});

describe('teacher login', () => {
  it('signs in with a synthetic email built from school and uppercased staff ID', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { route: AS_TEACHER, signedIn: true, claimsAfterRefresh: { sid: 'siripura', role: 'teacher', tid: 't1' } });
    await pickSchool(user);
    await user.type(screen.getByLabelText('Staff ID'), 'scc024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(api.signInWithPassword).toHaveBeenCalledWith('scc024@siripura.teachers.sathiya.lk', 'k7m4x9pq'),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/me');
    expect(recordSignIn).toHaveBeenCalledTimes(1);
  });

  it('shows the wrong-credentials message', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithPassword).mockRejectedValue(authError('auth/invalid-credential'));
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    await pickSchool(user);
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'bad');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(await within(teacherCard()).findByRole('alert')).toHaveTextContent('Wrong staff ID or password');
  });

  it('remembers the chosen school and restores it', async () => {
    const user = userEvent.setup();
    const first = renderAuth(<LoginPage />, { route: AS_TEACHER });
    await pickSchool(user);
    expect(JSON.parse(localStorage.getItem('sathiya.school') ?? '{}')).toMatchObject({ id: 'siripura' });
    first.unmount();
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya');
  });

  it('preselects the school from ?school=', async () => {
    vi.mocked(api.getDirectorySchool).mockResolvedValue(siripura);
    renderAuth(<LoginPage />, { route: '/login?as=teacher&school=siripura' });
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya'));
    expect(api.getDirectorySchool).toHaveBeenCalledWith('siripura');
  });

  it('explains a suspended school from ?school= instead of an empty picker', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getDirectorySchool).mockResolvedValue({ ...siripura, status: 'disabled' });
    renderAuth(<LoginPage />, { route: '/login?as=teacher&school=siripura' });
    expect(await screen.findByText('This school is currently suspended. Contact your school admin.')).toBeInTheDocument();
    expect(screen.getByLabelText('School')).toHaveValue('');
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(api.signInWithPassword).not.toHaveBeenCalled();
    expect(localStorage.getItem('sathiya.school')).toBeNull();
  });

  it('opens the teacher tab with the school preselected for ?school= alone', async () => {
    vi.mocked(api.getDirectorySchool).mockResolvedValue(siripura);
    renderAuth(<LoginPage />, { route: '/login?school=siripura' });
    expect(screen.getByRole('heading', { name: 'Teacher login' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya'));
  });

  it('keeps the admin tab reachable when ?school= is present', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { route: '/login?school=siripura' });
    await user.click(screen.getByRole('tab', { name: 'School admin' }));
    expect(screen.getByRole('heading', { name: 'Admin login' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('as=admin');
  });

  it('says when ?school= matches no school', async () => {
    vi.mocked(api.getDirectorySchool).mockResolvedValue(null);
    renderAuth(<LoginPage />, { route: '/login?as=teacher&school=bogus' });
    expect(await screen.findByText("We couldn't find that school. Choose it from the list.")).toBeInTheDocument();
    expect(screen.getByLabelText('School')).toHaveValue('');
  });

  it('clears the unknown-school message when ?school= changes to a real school', async () => {
    const user = userEvent.setup();
    vi.mocked(api.getDirectorySchool).mockImplementation(async (id) => (id === 'siripura' ? siripura : null));
    renderAuth(
      <>
        <LoginPage />
        <Link to="/login?as=teacher&school=siripura">switch</Link>
      </>,
      { route: '/login?as=teacher&school=bogus' },
    );
    expect(await screen.findByText("We couldn't find that school. Choose it from the list.")).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'switch' }));
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya'));
    expect(screen.queryByText("We couldn't find that school. Choose it from the list.")).not.toBeInTheDocument();
  });

  it('clears the chosen school when ?school= changes to a suspended school', async () => {
    const user = userEvent.setup();
    const closed = { ...siripura, id: 'closed', nameEn: 'Closed College', status: 'disabled' as const };
    vi.mocked(api.getDirectorySchool).mockImplementation(async (id) => (id === 'siripura' ? siripura : closed));
    renderAuth(
      <>
        <LoginPage />
        <Link to="/login?as=teacher&school=closed">switch</Link>
      </>,
      { route: '/login?as=teacher&school=siripura' },
    );
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya'));
    await user.click(screen.getByRole('link', { name: 'switch' }));
    expect(await screen.findByText('This school is currently suspended. Contact your school admin.')).toBeInTheDocument();
    expect(screen.getByLabelText('School')).toHaveValue('');
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(api.signInWithPassword).not.toHaveBeenCalled();
  });

  it('ignores a ?school= lookup that finishes after a school is picked by hand', async () => {
    const user = userEvent.setup();
    let finish: (s: null) => void = () => undefined;
    vi.mocked(api.getDirectorySchool).mockImplementation(() => new Promise((r) => (finish = r)));
    renderAuth(<LoginPage />, { route: '/login?as=teacher&school=bogus' });
    await pickSchool(user);
    finish(null);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByText("We couldn't find that school. Choose it from the list.")).not.toBeInTheDocument();
    expect(screen.getByLabelText('School')).toHaveValue('Siripura Central College, Peradeniya');
  });

  it('requires a school before submitting', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(api.signInWithPassword).not.toHaveBeenCalled();
    expect(await screen.findByText('Choose your school first')).toBeInTheDocument();
  });

  it('focuses the teacher card for ?as=teacher', async () => {
    renderAuth(<LoginPage />, { route: '/login?as=teacher' });
    await waitFor(() => expect(screen.getByLabelText('School')).toHaveFocus());
  });
});

describe('admin / teacher switch', () => {
  it('shows the admin form by default', () => {
    renderAuth(<LoginPage />);
    expect(screen.getByRole('tablist', { name: 'Sign in as' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'School admin' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Teacher' })).toHaveAttribute('aria-selected', 'false');
    expect(screen.getByRole('tabpanel', { name: 'School admin' })).toContainElement(
      screen.getByRole('heading', { name: 'Admin login' }),
    );
    expect(screen.queryByRole('heading', { name: 'Teacher login' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email')).not.toHaveFocus();
  });

  it('opens the teacher form for ?as=teacher', () => {
    renderAuth(<LoginPage />, { route: AS_TEACHER });
    expect(screen.getByRole('tab', { name: 'Teacher' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: 'Teacher login' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Admin login' })).not.toBeInTheDocument();
  });

  it('updates the URL, keeps other params and focuses the first field on click', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { route: '/login?report=1' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('tab', { name: 'Teacher' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login?report=1&as=teacher');
    expect(screen.getByLabelText('School')).toHaveFocus();
    await user.click(screen.getByRole('tab', { name: 'School admin' }));
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/login\?report=1$/);
    expect(screen.getByLabelText('Email')).toHaveFocus();
  });

  it('switches with arrow keys and keeps focus on the tab', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    await user.click(screen.getByRole('tab', { name: 'School admin' }));
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Teacher' })).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Teacher login' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login?as=teacher');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('tab', { name: 'School admin' })).toHaveFocus();
    expect(screen.getByTestId('location')).toHaveTextContent(/^\/login$/);
  });

  it('replaces the history entry instead of pushing', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    await user.click(screen.getByRole('tab', { name: 'Teacher' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/login?as=teacher');
    expect(screen.getByTestId('location')).toHaveAttribute('data-nav', 'REPLACE');
  });
});

describe('admin login', () => {
  const adminCard = () => screen.getByRole('heading', { name: 'Admin login' }).closest('form') as HTMLElement;

  it('claims invites, refreshes claims and routes admins to /admin', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    vi.mocked(api.claimInvites).mockImplementation(async () => void order.push('claim'));
    renderAuth(<LoginPage />, {
      signedIn: true,
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
      refreshClaims: async () => void order.push('refresh'),
    });
    const card = within(adminCard());
    await user.type(card.getByLabelText('Email'), 'principal@siripura.lk');
    await user.type(card.getByLabelText('Password'), 'secret12');
    await user.click(card.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(api.signInWithPassword).toHaveBeenCalledWith('principal@siripura.lk', 'secret12'),
    );
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
    expect(order).toEqual(['claim', 'refresh']);
  });

  it.each([
    [{ super: true }, '/super'],
    [{}, '/register'],
  ])('routes claims %j to %s', async (claims, path) => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: claims });
    await user.click(within(adminCard()).getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByTestId('where')).toHaveTextContent(path);
    expect(api.claimInvites).toHaveBeenCalled();
  });

  it('still routes when claimInvites fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.claimInvites).mockRejectedValue(new Error('boom'));
    renderAuth(<LoginPage />, { signedIn: true, claimsAfterRefresh: { sid: 's', role: 'admin' } });
    await user.click(within(adminCard()).getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
  });

  it('shows wrong-credentials message and stays put', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithPassword).mockRejectedValue(authError('auth/wrong-password'));
    renderAuth(<LoginPage />);
    const card = within(adminCard());
    await user.type(card.getByLabelText('Email'), 'a@b.lk');
    await user.type(card.getByLabelText('Password'), 'nope');
    await user.click(card.getByRole('button', { name: 'Log in' }));
    expect(await card.findByRole('alert')).toHaveTextContent('Wrong email or password');
    expect(api.claimInvites).not.toHaveBeenCalled();
  });

  it('renders the four-colour Google logo', () => {
    renderAuth(<LoginPage />);
    const logo = within(screen.getByRole('button', { name: 'Continue with Google' })).getByTestId('google-logo');
    const fills = Array.from(logo.querySelectorAll('path')).map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#EA4335', '#4285F4', '#FBBC05', '#34A853']);
  });

  it('ignores a closed Google popup', async () => {
    const user = userEvent.setup();
    vi.mocked(api.signInWithGoogle).mockRejectedValue(authError('auth/popup-closed-by-user'));
    renderAuth(<LoginPage />);
    await user.click(within(adminCard()).getByRole('button', { name: 'Continue with Google' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.claimInvites).not.toHaveBeenCalled();
  });
});

describe('refreshClaims failure after sign-in', () => {
  const failing = async () => {
    throw new Error('token');
  };

  it('teacher still navigates home without an error', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { route: AS_TEACHER, signedIn: true, claims: { sid: 's', role: 'teacher', tid: 't' }, refreshClaims: failing });
    await pickSchool(user);
    await user.type(screen.getByLabelText('Staff ID'), 'SCC024');
    await user.type(within(teacherCard()).getByLabelText('Password'), 'k7m4x9pq');
    await user.click(within(teacherCard()).getByRole('button', { name: 'Log in' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/me');
  });

  it('admin still navigates home without an error', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />, { signedIn: true, claims: { sid: 's', role: 'admin' }, refreshClaims: failing });
    const card = within(screen.getByRole('heading', { name: 'Admin login' }).closest('form') as HTMLElement);
    await user.click(card.getByRole('button', { name: 'Continue with Google' }));
    expect(await screen.findByTestId('where')).toHaveTextContent('/admin');
  });
});

describe('login form basics', () => {
  const adminCard = () => within(screen.getByRole('heading', { name: 'Admin login' }).closest('form') as HTMLElement);

  it('keeps Log in enabled and asks for missing details on submit', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    const card = adminCard();
    const submit = card.getByRole('button', { name: 'Log in' });
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(card.getByText('Enter your email and password.')).toBeInTheDocument();
    expect(api.signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows and hides the password', async () => {
    const user = userEvent.setup();
    renderAuth(<LoginPage />);
    const card = adminCard();
    const input = card.getByLabelText('Password');
    const toggle = card.getByRole('button', { name: 'Show password' });
    expect(input).toHaveAttribute('type', 'password');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'text');
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await user.click(toggle);
    expect(input).toHaveAttribute('type', 'password');
  });

  it('shows one language only', () => {
    renderAuth(<LoginPage />);
    expect(screen.queryByText('පරිපාලක පිවිසුම')).not.toBeInTheDocument();
  });
});

describe('brand logo', () => {
  it('links to the website home page', () => {
    renderAuth(<LoginPage />);
    expect(screen.getByRole('link', { name: /Sathiya/ })).toHaveAttribute('href', 'https://sathiya.kanushka.com/');
  });
});
