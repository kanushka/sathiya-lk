// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act, screen } from '@testing-library/react';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithI18n } from '../test/render';
import { ToastProvider, useToast } from './Toast';

function Show() {
  const toast = useToast();
  useEffect(() => toast.show('Saved'), [toast]);
  return null;
}

describe('ToastList', () => {
  it('sits under the phone top bar and at the bottom from md up', async () => {
    renderWithI18n(
      <ToastProvider>
        <Show />
      </ToastProvider>,
    );
    await act(async () => undefined);
    const list = screen.getByText('Saved').closest('[aria-live]');
    expect(list).toHaveClass('top-[4.5rem]', 'md:top-auto', 'md:bottom-4');
    expect(list).not.toHaveClass('bottom-4');
  });
});
