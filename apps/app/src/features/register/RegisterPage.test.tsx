// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import * as authApi from '../auth/api';
import { sendAuthEmail } from '../auth/authEmail';
import { pickOption } from '../../test/pickOption';
import { renderAuth } from '../auth/testHarness';
import { RegisterPage } from './RegisterPage';
import * as api from './api';

vi.mock('./api');
vi.mock('../auth/api');
vi.mock('../auth/authEmail');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.currentTermsVersion).mockResolvedValue('3');
  vi.mocked(api.createAccount).mockResolvedValue(undefined);
  vi.mocked(api.registerSchool).mockResolvedValue('siripura');
  vi.mocked(api.uploadLogo).mockResolvedValue('https://x/logo.png');
  vi.mocked(api.confirmVerified).mockResolvedValue(true);
  vi.mocked(sendAuthEmail).mockResolvedValue(undefined);
  vi.mocked(authApi.getDirectorySchool).mockResolvedValue(null);
  vi.mocked(authApi.searchSchools).mockResolvedValue([]);
});

async function fillSchool(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('School name (English)'), 'Siripura Central College');
  await user.type(screen.getByLabelText('City'), 'Kandy');
  await user.type(screen.getByLabelText('District'), 'Kandy');
  await user.clear(screen.getByLabelText('Staff ID prefix'));
  await user.type(screen.getByLabelText('Staff ID prefix'), 'scc');
  await user.type(screen.getByLabelText('Census number'), '03214');
  await user.click(screen.getByRole('button', { name: 'Next: logo & colours' }));
}

describe('register', () => {
  it('suggests a staff ID prefix from the school name until the user types their own', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    const name = screen.getByLabelText('School name (English)');
    const prefix = screen.getByLabelText('Staff ID prefix');
    await user.type(name, 'G/ P. D. S. Kularathne Collage');
    expect(prefix).toHaveValue('KC');
    await user.clear(name);
    await user.type(name, 'Royal College');
    expect(prefix).toHaveValue('RC');
    await user.clear(prefix);
    await user.type(prefix, 'roy');
    await user.type(name, ' Kandy');
    expect(prefix).toHaveValue('ROY');
  });

  it('blocks step 1 until the school details are valid', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    const next = screen.getByRole('button', { name: 'Next: logo & colours' });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText('School name (English)'), 'Siripura');
    await user.type(screen.getByLabelText('District'), 'Kandy');
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText('City'), 'Kandy');
    await user.clear(screen.getByLabelText('Staff ID prefix'));
    await user.type(screen.getByLabelText('Staff ID prefix'), 'S');
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText('Staff ID prefix'), 'cc');
    expect(screen.getByLabelText('Staff ID prefix')).toHaveValue('SCC');
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText('Census number'), '03214');
    expect(next).toBeEnabled();
  });

  it('requires a city and shows a message once it is cleared', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    const city = screen.getByLabelText('City');
    expect(screen.getByText('City', { selector: 'label' })).toHaveAttribute('data-required', 'true');
    expect(screen.getByText('Census number', { selector: 'label' })).toHaveAttribute('data-required', 'true');
    expect(screen.getByLabelText('Phone (optional)')).toHaveAttribute('type', 'tel');
    await user.type(city, 'K');
    await user.clear(city);
    expect(screen.getByText('City is required')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next: logo & colours' })).toBeDisabled();
  });

  it('sends address and phone when filled', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
    });
    await user.type(screen.getByLabelText('Address (optional)'), '  12 Temple Rd  ');
    await user.type(screen.getByLabelText('Phone (optional)'), '081 222 3344');
    await toStep3(user);
    await submitStep3(user);
    await waitFor(() => expect(api.registerSchool).toHaveBeenCalled());
    const req = vi.mocked(api.registerSchool).mock.calls[0]![0];
    expect(req.school).toMatchObject({ city: 'Kandy', address: '12 Temple Rd', phone: '081 222 3344' });
  });

  it('omits empty address and phone from the payload', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
    });
    await toStep3(user);
    await submitStep3(user);
    await waitFor(() => expect(api.registerSchool).toHaveBeenCalled());
    const school = vi.mocked(api.registerSchool).mock.calls[0]![0].school;
    expect(school).not.toHaveProperty('address');
    expect(school).not.toHaveProperty('phone');
  });

  it('offers 6 + 6 swatches, custom hex, and a preview with readable text colour', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    await fillSchool(user);
    const groups = screen.getAllByRole('group');
    expect(groups[0]!.querySelectorAll('button[aria-pressed]')).toHaveLength(6);
    expect(groups[1]!.querySelectorAll('button[aria-pressed]')).toHaveLength(6);

    await user.click(screen.getByRole('button', { name: '#7A1F3D' }));
    expect(screen.getByTestId('preview-button')).toHaveStyle({ background: '#7A1F3D', color: '#FFFFFF' });

    const [primaryHex] = screen.getAllByLabelText('Custom colour (hex)');
    await user.clear(primaryHex!);
    await user.type(primaryHex!, '#F2C94C');
    expect(screen.getByTestId('preview-button')).toHaveStyle({ background: '#F2C94C', color: '#14213D' });

    await user.clear(primaryHex!);
    await user.type(primaryHex!, '#12');
    expect(screen.getByText('Use a hex colour like #7A1F3D')).toBeInTheDocument();
  });

  it('rejects a logo that is not PNG or SVG', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    await fillSchool(user);
    const input = document.querySelector('input[type=file]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'a.jpg', { type: 'image/jpeg' })] } });
    expect(await screen.findByText('Logo must be a PNG or SVG')).toBeInTheDocument();
  });

  async function toStep3(user: ReturnType<typeof userEvent.setup>, withLogo = false) {
    await fillSchool(user);
    if (withLogo) {
      const input = document.querySelector('input[type=file]') as HTMLInputElement;
      fireEvent.change(input, { target: { files: [new File(['x'], 'logo.png', { type: 'image/png' })] } });
    }
    await user.click(screen.getByRole('button', { name: 'Next: your account' }));
  }

  it('keeps Create school disabled until terms are accepted', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    await toStep3(user);
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    const create = screen.getByRole('button', { name: 'Create school' });
    expect(create).toBeDisabled();
    await user.click(screen.getByRole('checkbox'));
    expect(create).toBeEnabled();
  });

  it('creates the account, registers, uploads the logo and goes to /admin', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
    });
    await toStep3(user, true);
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    await confirmGate(user);

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(api.createAccount).toHaveBeenCalledWith('nimal@siripura.lk', 'secret12', 'Nimal');
    expect(api.registerSchool).toHaveBeenCalledWith({
      school: {
        type: 'government',
        censusNo: '03214',
        nameEn: 'Siripura Central College',
        city: 'Kandy',
        district: 'Kandy',
        grades: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
        staffPrefix: 'SCC',
        colors: { primary: '#0E6B6A', second: '#D9A441' },
        termsVersion: '3',
      },
      adminName: 'Nimal',
      acceptedTermsVersion: '3',
    });
    expect(api.uploadLogo).toHaveBeenCalledWith('siripura', expect.objectContaining({ name: 'logo.png' }));
  });

  it('still finishes when the logo upload fails', async () => {
    const user = userEvent.setup();
    vi.mocked(api.uploadLogo).mockRejectedValue(new Error('storage'));
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
    });
    await toStep3(user, true);
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    await confirmGate(user);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(screen.getByText(/logo could not be uploaded/)).toBeInTheDocument();
  });

  it('skips account creation for an already signed-in user', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      signedIn: true,
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
    });
    await toStep3(user);
    expect(screen.queryByLabelText('Password')).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(api.createAccount).not.toHaveBeenCalled();
  });

  it('shows an email-in-use error on the email field', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createAccount).mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/email-already-in-use' }));
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    await toStep3(user);
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    expect(await screen.findByText('That email already has an account. Log in instead.')).toBeInTheDocument();
    expect(api.registerSchool).not.toHaveBeenCalled();
  });

  it('shows a policy rejection on the password field', async () => {
    const user = userEvent.setup();
    vi.mocked(api.createAccount).mockRejectedValue(Object.assign(new Error('x'), { code: 'auth/password-does-not-meet-requirements' }));
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    await toStep3(user);
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    expect(await screen.findByText('Password must be at least 8 characters')).toBeInTheDocument();
  });

  async function confirmGate(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByRole('button', { name: "I've confirmed it" }));
    await user.click(await screen.findByRole('button', { name: 'Create school' }));
  }

  async function submitStep3(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
    await user.type(screen.getByLabelText('Password'), 'secret12');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    await confirmGate(user);
  }

  it('refreshes claims before uploading the logo', async () => {
    const user = userEvent.setup();
    const order: string[] = [];
    vi.mocked(api.uploadLogo).mockImplementation(async () => {
      order.push('upload');
      return 'u';
    });
    vi.mocked(api.registerSchool).mockImplementation(async () => {
      order.push('register');
      return 'siripura';
    });
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
      refreshClaims: async () => void order.push('refresh'),
    });
    await toStep3(user, true);
    await submitStep3(user);
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(order).toEqual(['register', 'refresh', 'upload']);
  });

  it('retries after a registerSchool failure without creating a second account', async () => {
    const user = userEvent.setup();
    vi.mocked(api.registerSchool).mockRejectedValueOnce(new Error('down'));
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      claimsAfterRefresh: { sid: 'siripura', role: 'admin' },
    });
    await toStep3(user);
    await submitStep3(user);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(api.createAccount).toHaveBeenCalledTimes(1);
    expect(api.registerSchool).toHaveBeenCalledTimes(2);
  });

  it('goes home when refreshClaims fails after registering', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, {
      route: '/register',
      at: '/register',
      signedIn: true,
      refreshClaims: async () => {
        throw new Error('token');
      },
    });
    await toStep3(user);
    await user.type(screen.getByLabelText('Your name'), 'Nimal');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create school' }));
    await waitFor(() => expect(api.registerSchool).toHaveBeenCalled());
    expect(await screen.findByRole('button', { name: 'Next: logo & colours' })).toBeInTheDocument();
  });

  describe('census', () => {
    it('shows a census message for a bad format', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
      await user.type(screen.getByLabelText('Census number'), '12a');
      expect(screen.getByText('Census number must be 4 to 6 digits')).toBeInTheDocument();
    });

    it('enables "No census number" only for private and international schools and clears the field', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
      const box = screen.getByRole('checkbox', { name: /No census number/ });
      expect(box).toBeDisabled();
      await user.type(screen.getByLabelText('Census number'), '1234');
      await pickOption(user, screen.getByRole('combobox', { name: /^School type/ }), 'Private');
      expect(box).toBeEnabled();
      await user.click(box);
      expect(screen.getByLabelText('Census number')).toBeDisabled();
      expect(screen.getByLabelText('Census number')).toHaveValue('');
      await pickOption(user, screen.getByRole('combobox', { name: /^School type/ }), 'Government');
      expect(box).toBeDisabled();
      expect(box).not.toBeChecked();
      expect(screen.getByLabelText('Census number')).toBeEnabled();
    });

    it('sends type and census, and omits census when none', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true, claimsAfterRefresh: { sid: 's', role: 'admin' } });
      await user.type(screen.getByLabelText('School name (English)'), 'Lake School');
      await user.type(screen.getByLabelText('City'), 'Kandy');
      await user.type(screen.getByLabelText('District'), 'Kandy');
      await user.type(screen.getByLabelText('Staff ID prefix'), 'lsc');
      await pickOption(user, screen.getByRole('combobox', { name: /^School type/ }), 'Private');
      await user.click(screen.getByRole('checkbox', { name: /No census number/ }));
      await user.click(screen.getByRole('button', { name: 'Next: logo & colours' }));
      await user.click(screen.getByRole('button', { name: 'Next: your account' }));
      await user.type(screen.getByLabelText('Your name'), 'Nimal');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Create school' }));
      await waitFor(() => expect(api.registerSchool).toHaveBeenCalled());
      const school = vi.mocked(api.registerSchool).mock.calls[0]![0].school;
      expect(school.type).toBe('private');
      expect(school).not.toHaveProperty('censusNo');
    });

    it('includes censusNo for a government school', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true, claimsAfterRefresh: { sid: 's', role: 'admin' } });
      await toStep3(user);
      await user.type(screen.getByLabelText('Your name'), 'Nimal');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Create school' }));
      await waitFor(() => expect(api.registerSchool).toHaveBeenCalled());
      expect(vi.mocked(api.registerSchool).mock.calls[0]![0].school).toMatchObject({ type: 'government', censusNo: '03214' });
    });
  });

  describe('registerSchool failures', () => {
    async function submitSignedIn(user: ReturnType<typeof userEvent.setup>) {
      await toStep3(user);
      await user.type(screen.getByLabelText('Your name'), 'Nimal');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Create school' }));
    }
    const opts = { route: '/register', at: '/register' as const, signedIn: true };

    it('census-taken returns to step 1 with an alert and a report link preselecting the school', async () => {
      const user = userEvent.setup();
      vi.mocked(api.registerSchool).mockRejectedValue(new ApiError('invalid', 'x', { code: 'census-taken', schoolId: 'siripura' }));
      vi.mocked(authApi.getDirectorySchool).mockResolvedValue({ id: 'siripura', nameEn: 'Siripura Central College', district: 'Kandy', status: 'active' });
      renderAuth(<RegisterPage />, opts);
      await submitSignedIn(user);
      const alert = await screen.findByText(/already registered on Sathiya/);
      expect(alert).toBeInTheDocument();
      expect(screen.getByLabelText('Census number')).toHaveAttribute('aria-invalid', 'true');
      await user.click(screen.getByRole('button', { name: 'report it' }));
      const dlg = screen.getByRole('dialog', { name: 'Report a school' });
      expect(await within(dlg).findByDisplayValue(/Siripura Central College/)).toBeInTheDocument();
    });

    it('census-taken without a school id opens an empty report popup', async () => {
      const user = userEvent.setup();
      vi.mocked(api.registerSchool).mockRejectedValue(new ApiError('invalid', 'x', { code: 'census-taken' }));
      renderAuth(<RegisterPage />, opts);
      await submitSignedIn(user);
      await screen.findByText(/already registered on Sathiya/);
      await user.click(screen.getByRole('button', { name: 'report it' }));
      expect(authApi.getDirectorySchool).not.toHaveBeenCalled();
      expect(within(screen.getByRole('dialog', { name: 'Report a school' })).getByLabelText('School')).toHaveValue('');
    });

    it.each([
      ['already-has-school', /already registered a school/],
      ['rate-limited', /Too many attempts/],
    ])('shows a clear message for %s', async (code, text) => {
      const user = userEvent.setup();
      vi.mocked(api.registerSchool).mockRejectedValue(new ApiError('invalid', 'raw backend text', { code }));
      renderAuth(<RegisterPage />, opts);
      await submitSignedIn(user);
      expect(await screen.findByRole('alert')).toHaveTextContent(text);
    });

    it('shows the generic message rather than raw backend text for unmapped errors', async () => {
      const user = userEvent.setup();
      vi.mocked(api.registerSchool).mockRejectedValue(new ApiError('invalid', 'raw backend text', { code: 'something-else' }));
      renderAuth(<RegisterPage />, opts);
      await submitSignedIn(user);
      const alert = await screen.findByRole('alert');
      expect(alert).not.toHaveTextContent('raw backend text');
      expect(alert).toHaveTextContent(/went wrong|try again/i);
    });

    it('email-unverified sends the user back to the verify gate', async () => {
      const user = userEvent.setup();
      vi.mocked(api.registerSchool).mockRejectedValue(new ApiError('invalid', 'x', { code: 'email-unverified' }));
      renderAuth(<RegisterPage />, opts);
      await submitSignedIn(user);
      expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
    });
  });

  describe('verify email gate', () => {
    it('gates an unverified password user before the wizard', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true, passwordUser: true, emailVerified: false });
      expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
      expect(screen.getByText('a@b.lk', { selector: 'b' })).toBeInTheDocument();
      expect(screen.queryByLabelText('School name (English)')).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: "I've confirmed it" }));
      expect(await screen.findByLabelText('School name (English)')).toBeInTheDocument();
      expect(api.confirmVerified).toHaveBeenCalled();
    });

    it('says not verified yet and stays on the gate', async () => {
      const user = userEvent.setup();
      vi.mocked(api.confirmVerified).mockResolvedValue(false);
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true, passwordUser: true, emailVerified: false });
      await user.click(screen.getByRole('button', { name: "I've confirmed it" }));
      expect(await screen.findByText(/Not verified yet/)).toBeInTheDocument();
      expect(screen.queryByLabelText('School name (English)')).not.toBeInTheDocument();
    });

    it('sends the email again and confirms', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true, passwordUser: true, emailVerified: false });
      await user.click(screen.getByRole('button', { name: 'Send again' }));
      expect(sendAuthEmail).toHaveBeenCalledWith({ kind: 'verify', lang: 'en' });
      expect(await screen.findByText('Verification email sent.')).toBeInTheDocument();
    });

    it('shows the rate-limit message when resending is rate-limited', async () => {
      const user = userEvent.setup();
      vi.mocked(sendAuthEmail).mockRejectedValue(new ApiError('invalid', 'x', { code: 'rate-limited' }));
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true, passwordUser: true, emailVerified: false });
      await user.click(screen.getByRole('button', { name: 'Send again' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/Too many attempts/);
    });

    it('skips the gate for Google and verified users', () => {
      renderAuth(<RegisterPage />, { route: '/register', at: '/register', signedIn: true });
      expect(screen.getByLabelText('School name (English)')).toBeInTheDocument();
    });

    it('never calls registerSchool right after creating a new account', async () => {
      const user = userEvent.setup();
      renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
      await toStep3(user);
      await user.type(screen.getByLabelText('Your name'), 'Nimal');
      await user.type(screen.getByLabelText('Email'), 'nimal@siripura.lk');
      await user.type(screen.getByLabelText('Password'), 'secret12');
      await user.click(screen.getByRole('checkbox'));
      await user.click(screen.getByRole('button', { name: 'Create school' }));
      expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument();
      expect(api.createAccount).toHaveBeenCalledTimes(1);
      expect(sendAuthEmail).toHaveBeenCalledWith({ kind: 'verify', lang: 'en' });
      expect(api.registerSchool).not.toHaveBeenCalled();
    });
  });
});
