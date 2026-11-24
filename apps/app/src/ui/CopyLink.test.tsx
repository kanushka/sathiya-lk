// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithI18n } from '../test/render';
import { CopyLink } from './CopyLink';
import { ToastProvider } from './Toast';

function renderLink() {
  renderWithI18n(
    <ToastProvider>
      <CopyLink url="https://app.example/join/s1/abc" copyLabel="Copy school link" label="School link" />
    </ToastProvider>,
  );
}

describe('CopyLink', () => {
  it('copies the url and confirms', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    renderLink();
    expect(screen.getByText('https://app.example/join/s1/abc')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Copy school link' }));
    expect(writeText).toHaveBeenCalledWith('https://app.example/join/s1/abc');
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
  });

  it('shows an error toast when the clipboard fails', async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'));
    renderLink();
    await user.click(screen.getByRole('button', { name: 'Copy school link' }));
    await waitFor(() => expect(screen.getByText('Could not copy. Select the link and copy it.')).toBeInTheDocument());
    expect(screen.queryByText('Copied!')).toBeNull();
  });
});
