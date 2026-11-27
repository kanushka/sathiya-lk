// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { ProfilePage } from './ProfilePage';

const flags = vi.hoisted(() => ({ readOnly: false }));

vi.mock('./api');
vi.mock('../register/api');
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

const brand = () => document.documentElement.style.getPropertyValue('--brand');

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  document.documentElement.style.removeProperty('--brand');
});

function setup() {
  const view = renderWithSchool(<ProfilePage />, { ctx: { ...ctx, school: { ...ctx.school, city: '' } } });
  return { user: userEvent.setup(), view };
}

describe('profile page', () => {
  it('prefills the saved profile', () => {
    setup();
    expect(screen.getByLabelText('School name in English')).toHaveValue('Siripura Central College');
    expect(screen.getByLabelText('Staff ID prefix')).toHaveValue('SCC');
  });

  it('applies picked colours live and reverts on leave without saving', async () => {
    const { user, view } = setup();
    await user.click(screen.getByRole('button', { name: '#1D3E7A' }));
    expect(brand()).toBe('#1D3E7A');
    expect(api.updateSchool).not.toHaveBeenCalled();
    view.unmount();
    expect(brand()).toBe('#7A1F3D');
  });

  it('warns when the primary colour is too light for white text', async () => {
    const { user } = setup();
    expect(screen.queryByText(/too light/i)).not.toBeInTheDocument();
    await user.type(screen.getAllByLabelText('Custom colour (hex)')[0]!, '#F2C94C');
    expect(screen.getByText(/too light/i)).toBeInTheDocument();
  });

  it('saves edits in one write', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);
    const { user } = setup();
    const nameEn = screen.getByLabelText('School name in English');
    await user.clear(nameEn);
    await user.type(nameEn, 'Siripura MV');
    await user.click(screen.getByRole('button', { name: '#1D3E7A' }));
    await user.type(screen.getByLabelText('City'), 'Kurunegala');
    await user.type(screen.getByLabelText('Phone (optional)'), '0371234567');
    expect(api.updateSchool).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(api.updateSchool).toHaveBeenCalledTimes(1);
    expect(api.updateSchool).toHaveBeenCalledWith('siripura', {
      nameEn: 'Siripura MV',
      nameSi: 'සිරිපුර මධ්‍ය විද්‍යාලය',
      city: 'Kurunegala',
      district: 'Kurunegala',
      phone: '0371234567',
      staffPrefix: 'SCC',
      colors: { primary: '#1D3E7A', second: '#D9A441' },
    });
  });

  it('blocks save on an invalid prefix or empty name and warns about existing IDs', async () => {
    const { user } = setup();
    expect(screen.getByText(/existing staff IDs are not changed/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText('City'), 'Kurunegala');
    const prefix = screen.getByLabelText('Staff ID prefix');
    await user.clear(prefix);
    await user.type(prefix, 'a');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    await user.clear(prefix);
    await user.type(prefix, 'scc');
    expect(prefix).toHaveValue('SCC');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await user.clear(screen.getByLabelText('School name in English'));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
    await user.clear(screen.getByLabelText('School name in Sinhala'));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
    expect(screen.getByText('Enter the name in English or Sinhala (or both).')).toBeInTheDocument();
  });

  it('keeps the saved prefix on rename and suggests one only after the prefix is cleared', async () => {
    const { user } = setup();
    const name = screen.getByLabelText('School name in English');
    const prefix = screen.getByLabelText('Staff ID prefix');
    await user.clear(name);
    await user.type(name, 'Royal College');
    expect(prefix).toHaveValue('SCC');
    await user.clear(prefix);
    expect(prefix).toHaveAttribute('placeholder', 'RC');
    await user.type(name, ' Kandy');
    expect(prefix).toHaveValue('RCK');
    await user.clear(prefix);
    await user.type(prefix, 'xyz');
    await user.type(name, ' Town');
    expect(prefix).toHaveValue('XYZ');
  });

  it('requires a city', async () => {
    const { user } = setup();
    const save = screen.getByRole('button', { name: 'Save changes' });
    expect(save).toBeDisabled();
    expect(screen.getByText('City is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('City'), 'Kurunegala');
    expect(save).toBeEnabled();
    expect(screen.queryByText('City is required')).not.toBeInTheDocument();
  });

  it('clears optional contact fields instead of writing blanks', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);
    const { user } = setup();
    await user.type(screen.getByLabelText('City'), 'Kurunegala');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const patch = vi.mocked(api.updateSchool).mock.calls[0]![1];
    expect(patch.address).toBeUndefined();
    expect(patch.phone).toBeUndefined();
  });

  it('toasts and re-enables save when saving fails', async () => {
    vi.mocked(api.updateSchool).mockRejectedValue(new Error('boom'));
    const { user } = setup();
    await user.type(screen.getByLabelText('City'), 'Kurunegala');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Could not save. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('is view-only when read-only', () => {
    flags.readOnly = true;
    setup();
    expect(screen.queryByRole('button', { name: 'Save changes' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('School name in English')).toBeDisabled();
  });
});

describe('profile page for a reviewed school', () => {
  const reviewed = { ...ctx, school: { ...ctx.school, censusNo: '01234', review: { moeMatched: true } } };

  it('shows both names, district and census number read-only', () => {
    renderWithSchool(<ProfilePage />, { ctx: reviewed });
    for (const label of ['District', 'Census number']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveAccessibleDescription('Locked after registration. Contact Sathiya to change it.');
    }
    for (const label of ['School name in English', 'School name in Sinhala']) {
      const input = screen.getByLabelText(label);
      expect(input).toHaveAttribute('readonly');
      expect(input).toHaveAccessibleDescription('A name change needs Sathiya approval.');
    }
    expect(screen.getByLabelText('Census number')).toHaveValue('01234');
  });

  it('saves without the locked fields', async () => {
    vi.mocked(api.updateSchool).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithSchool(<ProfilePage />, { ctx: reviewed });
    await user.type(screen.getByLabelText('City'), 'X');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    const patch = vi.mocked(api.updateSchool).mock.calls[0]![1];
    expect(patch).not.toHaveProperty('nameEn');
    expect(patch).not.toHaveProperty('nameSi');
    expect(patch).not.toHaveProperty('district');
    expect(patch.city).toMatch(/X$/);
  });

  it('sends a name change request with both names', async () => {
    vi.mocked(api.requestNameChange).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithSchool(<ProfilePage />, { ctx: reviewed });
    await user.click(screen.getByRole('button', { name: 'Request a name change' }));
    const dialog = screen.getByRole('dialog', { name: 'Request a name change' });
    const send = within(dialog).getByRole('button', { name: 'Send request' });
    expect(send).toBeDisabled();
    const en = within(dialog).getByLabelText('New name in English');
    await user.clear(en);
    await user.type(en, 'G/ Siripura M.V.');
    const si = within(dialog).getByLabelText('New name in Sinhala');
    await user.clear(si);
    await user.type(si, 'ගා/ සිරිපුර ම.වි.');
    await user.click(send);
    expect(api.requestNameChange).toHaveBeenCalledWith('siripura', { nameEn: 'G/ Siripura M.V.', nameSi: 'ගා/ සිරිපුර ම.වි.' });
    expect(api.updateSchool).not.toHaveBeenCalled();
    expect(await screen.findByText('Name change request sent')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('sends the request on Enter in a name input', async () => {
    vi.mocked(api.requestNameChange).mockResolvedValue(undefined);
    const user = userEvent.setup();
    renderWithSchool(<ProfilePage />, { ctx: reviewed });
    await user.click(screen.getByRole('button', { name: 'Request a name change' }));
    const en = within(screen.getByRole('dialog')).getByLabelText('New name in English');
    await user.type(en, '{Enter}');
    expect(api.requestNameChange).not.toHaveBeenCalled();
    await user.type(en, ' MV{Enter}');
    expect(api.requestNameChange).toHaveBeenCalledWith('siripura', expect.objectContaining({ nameEn: 'Siripura Central College MV' }));
  });

  it('shows a pending request and keeps the current name', () => {
    const nameChange = { nameEn: 'G/ Siripura M.V.', nameSi: 'ගා/ සිරිපුර ම.වි.', status: 'pending' as const, requestedAt: 1, requestedBy: 'u1' };
    renderWithSchool(<ProfilePage />, { ctx: { ...reviewed, school: { ...reviewed.school, nameChange } } });
    const banner = screen.getByText('Waiting for name change approval').closest('[role="status"]')!;
    expect(banner).toHaveTextContent('G/ Siripura M.V.');
    expect(banner).toHaveTextContent('ගා/ සිරිපුර ම.වි.');
    expect(screen.getByLabelText('School name in English')).toHaveValue('Siripura Central College');
  });

  it('shows a rejected request with the reason', () => {
    const nameChange = { nameEn: 'Royal', status: 'rejected' as const, requestedAt: 1, requestedBy: 'u1', reason: 'Use the MOE name' };
    renderWithSchool(<ProfilePage />, { ctx: { ...reviewed, school: { ...reviewed.school, nameChange } } });
    const banner = screen.getByText('Name change not approved').closest('[role="alert"]')!;
    expect(banner).toHaveTextContent('Royal');
    expect(banner).toHaveTextContent('Use the MOE name');
  });

  it('hides the request button when read-only', () => {
    flags.readOnly = true;
    renderWithSchool(<ProfilePage />, { ctx: reviewed });
    expect(screen.queryByRole('button', { name: 'Request a name change' })).not.toBeInTheDocument();
  });

  it('keeps the fields editable without a review record', () => {
    setup();
    expect(screen.getByLabelText('School name in English')).not.toHaveAttribute('readonly');
    expect(screen.getByLabelText('District')).not.toHaveAttribute('readonly');
    expect(screen.queryByLabelText('Census number')).not.toBeInTheDocument();
  });
});
