// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
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
    expect(screen.getByLabelText('School name (English)')).toHaveValue('Siripura Central College');
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
    const nameEn = screen.getByLabelText('School name (English)');
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
    await user.clear(screen.getByLabelText('School name (English)'));
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled();
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
    expect(screen.getByLabelText('School name (English)')).toBeDisabled();
  });
});
