// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx, entries, TPL } from '@sathiya/core/fixtures';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import * as api from './api';
import { TemplatesPage } from './TemplatesPage';

const flags = vi.hoisted(() => ({ readOnly: false }));

vi.mock('./api');
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
});

function setup() {
  renderWithSchool(<TemplatesPage />, { ctx, entries });
  return userEvent.setup();
}

describe('templates page', () => {
  it('lists templates with class usage', () => {
    setup();
    expect(screen.getByText(/used by 3 classes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Short Friday/ })).toHaveTextContent(/· 1 class$/);
  });

  it('rejects overlapping rows', async () => {
    const user = setup();
    fireEvent.change(screen.getByLabelText('Start, row 2'), { target: { value: '08:00' } });
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/overlap/i);
    expect(api.saveTemplate).not.toHaveBeenCalled();
  });

  it('per-day switch copies rows to every day', async () => {
    const user = setup();
    await user.click(screen.getByRole('radio', { name: 'Different per day' }));
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    await user.click(screen.getByRole('tab', { name: 'Fri' }));
    expect(screen.getAllByLabelText(/^Start, row/)).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    const [, , patch] = vi.mocked(api.saveTemplate).mock.calls[0]!;
    expect(patch.mode).toBe('perDay');
    expect(Object.keys(patch.days!)).toEqual(['0', '1', '2', '3', '4']);
    expect(patch.days![4]).toEqual(patch.rows);
  });

  it('shrink warning shows orphan count and needs confirmation', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Short Friday/ }));
    await user.click(screen.getByRole('tab', { name: 'Fri' }));
    await user.click(screen.getByRole('button', { name: 'Remove row 8' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/1 timetable entry will be orphaned/i)).toBeInTheDocument();
    expect(api.saveTemplate).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Save anyway' }));
    expect(api.saveTemplate).toHaveBeenCalledTimes(1);
  });

  it('sets a non-default template as default', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Primary/ }));
    await user.click(screen.getByRole('button', { name: 'Set as default' }));
    expect(api.setDefaultTemplate).toHaveBeenCalledWith(ctx.school.id, TPL.primary, [TPL.default]);
  });

  it('cannot delete the default template', async () => {
    const user = setup();
    expect(screen.queryByRole('button', { name: 'Delete template' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Primary/ }));
    expect(screen.getByRole('button', { name: 'Delete template' })).toBeInTheDocument();
  });

  it('creates a template from a centred modal', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: '+ New template' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Exam week');
    await user.click(within(dialog).getByRole('button', { name: 'Create template' }));
    expect(api.createTemplate).toHaveBeenCalledWith(ctx.school.id, 'Exam week', expect.any(Array));
  });

  it('keeps the modal usable and shows an error when create fails', async () => {
    const user = setup();
    vi.mocked(api.createTemplate).mockRejectedValue(new Error('boom'));
    await user.click(screen.getByRole('button', { name: '+ New template' }));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Name'), 'Exam week');
    await user.click(within(dialog).getByRole('button', { name: 'Create template' }));
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Create template' })).toBeEnabled();
  });

  it('rejects a blank time and never shows NaN minutes', async () => {
    const user = setup();
    const start = screen.getByLabelText('Start, row 1');
    fireEvent.change(start, { target: { value: '' } });
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.saveTemplate).not.toHaveBeenCalled();
    expect(screen.getByText(/Row 1: enter a valid time/)).toBeInTheDocument();
  });

  it('read-only hides every write control', () => {
    flags.readOnly = true;
    setup();
    for (const name of ['Save template', '+ New template', 'Set as default', '+ Period', '+ Interval', 'Delete template']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('Start, row 1')).toBeDisabled();
  });
});
