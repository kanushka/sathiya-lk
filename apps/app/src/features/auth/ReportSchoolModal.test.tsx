// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/callable';
import * as api from './api';
import { ReportSchoolModal } from './ReportSchoolModal';
import { renderAuth } from './testHarness';

vi.mock('./api');

const siripura = { id: 'siripura', nameEn: 'Siripura Central College', district: 'Kandy', city: 'Peradeniya', status: 'active' as const };

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.searchSchools).mockResolvedValue([siripura]);
  vi.mocked(api.getDirectorySchool).mockResolvedValue(siripura);
  vi.mocked(api.reportSchool).mockResolvedValue(undefined);
});

const dialog = () => screen.getByRole('dialog', { name: 'Report a school' });

describe('ReportSchoolModal', () => {
  it('needs a school and a reason before sending, then sends only the filled fields', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderAuth(<ReportSchoolModal open onClose={onClose} />);
    const send = within(dialog()).getByRole('button', { name: 'Send report' });
    expect(send).toBeDisabled();
    await user.type(within(dialog()).getByLabelText('School'), 'siri');
    await user.click(await screen.findByRole('option', { name: /Siripura/ }));
    expect(send).toBeDisabled();
    await user.click(within(dialog()).getByRole('radio', { name: 'Duplicate of another school' }));
    expect(send).toBeEnabled();
    await user.click(send);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.reportSchool).toHaveBeenCalledWith({ schoolId: 'siripura', reason: 'duplicate' });
  });

  it('includes details and email when given', async () => {
    const user = userEvent.setup();
    renderAuth(<ReportSchoolModal open onClose={() => undefined} />);
    await user.type(within(dialog()).getByLabelText('School'), 'siri');
    await user.click(await screen.findByRole('option', { name: /Siripura/ }));
    await user.click(within(dialog()).getByRole('radio', { name: 'Not the real school / fake' }));
    await user.type(within(dialog()).getByLabelText(/Details/), ' We never registered ');
    await user.type(within(dialog()).getByLabelText(/Your email/), 'p@x.lk');
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(api.reportSchool).toHaveBeenCalled());
    expect(api.reportSchool).toHaveBeenCalledWith({
      schoolId: 'siripura',
      reason: 'fake',
      details: 'We never registered',
      email: 'p@x.lk',
    });
  });

  it('preselects the school from initialSchoolId', async () => {
    renderAuth(<ReportSchoolModal open onClose={() => undefined} initialSchoolId="siripura" />);
    expect(await within(dialog()).findByDisplayValue('Siripura Central College, Peradeniya')).toBeInTheDocument();
    expect(api.getDirectorySchool).toHaveBeenCalledWith('siripura');
  });

  it('shows an error and stays open when sending fails', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(api.reportSchool).mockRejectedValue(new ApiError('invalid', 'x'));
    renderAuth(<ReportSchoolModal open onClose={onClose} initialSchoolId="siripura" />);
    await within(dialog()).findByDisplayValue(/Siripura/);
    await user.click(within(dialog()).getByRole('radio', { name: 'Other' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Could not send the report');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('explains rate limiting', async () => {
    const user = userEvent.setup();
    vi.mocked(api.reportSchool).mockRejectedValue(new ApiError('invalid', 'x', { code: 'rate-limited' }));
    renderAuth(<ReportSchoolModal open onClose={() => undefined} initialSchoolId="siripura" />);
    await within(dialog()).findByDisplayValue(/Siripura/);
    await user.click(within(dialog()).getByRole('radio', { name: 'Other' }));
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }));
    expect(await within(dialog()).findByRole('alert')).toHaveTextContent('Too many reports');
  });
});
