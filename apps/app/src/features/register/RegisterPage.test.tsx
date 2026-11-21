import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAuth } from '../auth/testHarness';
import { RegisterPage } from './RegisterPage';
import * as api from './api';

vi.mock('./api');

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.currentTermsVersion).mockResolvedValue('3');
  vi.mocked(api.createAccount).mockResolvedValue(undefined);
  vi.mocked(api.registerSchool).mockResolvedValue('siripura');
  vi.mocked(api.uploadLogo).mockResolvedValue('https://x/logo.png');
});

async function fillSchool(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('School name (English)'), 'Siripura Central College');
  await user.type(screen.getByLabelText('District'), 'Kandy');
  await user.type(screen.getByLabelText('Staff ID prefix'), 'scc');
  await user.click(screen.getByRole('button', { name: 'Next: logo & colours' }));
}

describe('register', () => {
  it('blocks step 1 until the school details are valid', async () => {
    const user = userEvent.setup();
    renderAuth(<RegisterPage />, { route: '/register', at: '/register' });
    const next = screen.getByRole('button', { name: 'Next: logo & colours' });
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText('School name (English)'), 'Siripura');
    await user.type(screen.getByLabelText('District'), 'Kandy');
    await user.type(screen.getByLabelText('Staff ID prefix'), 'S');
    expect(next).toBeDisabled();
    await user.type(screen.getByLabelText('Staff ID prefix'), 'cc');
    expect(screen.getByLabelText('Staff ID prefix')).toHaveValue('SCC');
    expect(next).toBeEnabled();
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

    await waitFor(() => expect(screen.getByTestId('where')).toHaveTextContent('/admin'));
    expect(api.createAccount).toHaveBeenCalledWith('nimal@siripura.lk', 'secret12', 'Nimal');
    expect(api.registerSchool).toHaveBeenCalledWith({
      school: {
        nameEn: 'Siripura Central College',
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
});
