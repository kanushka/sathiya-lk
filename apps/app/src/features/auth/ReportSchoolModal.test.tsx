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

  async function readyToSend(user: ReturnType<typeof userEvent.setup>) {
    renderAuth(<ReportSchoolModal open onClose={() => undefined} initialSchoolId="siripura" />);
    await within(dialog()).findByDisplayValue(/Siripura/);
    await user.click(within(dialog()).getByRole('radio', { name: 'Other' }));
  }

  it('rejects a malformed email with a field error without calling the callable', async () => {
    const user = userEvent.setup();
    await readyToSend(user);
    const email = within(dialog()).getByLabelText(/Your email/);
    await user.type(email, 'bad-email');
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }));
    expect(api.reportSchool).not.toHaveBeenCalled();
    expect(email).toBeInvalid();
    expect(email).toHaveAccessibleDescription('Enter a valid email address');
    await user.type(email, 'x');
    expect(within(dialog()).queryByText('Enter a valid email address')).not.toBeInTheDocument();
  });

  it('maps a server invalid-email rejection to the email field', async () => {
    const user = userEvent.setup();
    vi.mocked(api.reportSchool).mockRejectedValue(new ApiError('invalid', 'email is not a valid email'));
    await readyToSend(user);
    const email = within(dialog()).getByLabelText(/Your email/);
    await user.type(email, 'a@b.co');
    await user.click(within(dialog()).getByRole('button', { name: 'Send report' }));
    await waitFor(() => expect(email).toBeInvalid());
    expect(within(dialog()).queryByText(/Could not send the report/)).not.toBeInTheDocument();
  });
});
