// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { SaveTemplateRes } from '@sathiya/core';
import { ctx, entries, TPL } from '@sathiya/core/fixtures';
import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { pickOption } from '../../test/pickOption';
import { renderWithSchool } from '../../test/renderWithSchool';
import { ApiError } from '../../lib/callable';
import * as api from './api';
import { TemplatesPage } from './TemplatesPage';

const flags = vi.hoisted(() => ({ readOnly: false }));

vi.mock('./api');
vi.mock('../../lib/callable', async (orig) => ({ ...(await orig<typeof import('../../lib/callable')>()), call: vi.fn() }));
vi.mock('../../ui/AdminLayout', async (orig) => ({ ...(await orig<typeof import('../../ui/AdminLayout')>()), useReadOnly: () => flags.readOnly }));

const res = (over: Partial<SaveTemplateRes> = {}): SaveTemplateRes => ({ moved: 0, blocked: 0, orphaned: 0, ...over });

beforeEach(() => {
  vi.resetAllMocks();
  flags.readOnly = false;
  vi.mocked(api.saveTemplateWithRemap).mockResolvedValue(res());
});

function setup() {
  renderWithSchool(<TemplatesPage />, { ctx, entries });
  return userEvent.setup();
}

describe('templates page', () => {
  it('lets the list and editor take the full width on phones', () => {
    setup();
    const editor = screen.getAllByTestId('template-row')[0]!.closest('section')!;
    expect(editor).toHaveClass('md:min-w-[520px]');
    expect(editor).not.toHaveClass('min-w-[520px]');
    expect(screen.getAllByTestId('template-row')[0]).toHaveClass('flex-wrap', 'md:flex-nowrap');
  });

  it('puts + New template at the top right of the page header', () => {
    setup();
    expect(within(screen.getByTestId('page-header')).getAllByRole('button').at(-1)).toHaveTextContent('+ New template');
  });

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
    expect(api.saveTemplateWithRemap).not.toHaveBeenCalled();
  });

  it('per-day switch copies rows to every day', async () => {
    const user = setup();
    await user.click(screen.getByRole('radio', { name: 'Different per day' }));
    expect(screen.getAllByRole('tab')).toHaveLength(5);
    await user.click(screen.getByRole('tab', { name: 'Fri' }));
    expect(screen.getAllByLabelText(/^Start, row/)).toHaveLength(9);
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    const [, , patch] = vi.mocked(api.saveTemplateWithRemap).mock.calls[0]!;
    expect(patch.mode).toBe('perDay');
    expect(Object.keys(patch.days!)).toEqual(['0', '1', '2', '3', '4']);
    expect(patch.days![4]).toEqual(patch.rows);
  });

  it('shows the shrink warning with the server orphan count, then saves on confirm', async () => {
    const user = setup();
    vi.mocked(api.saveTemplateWithRemap).mockResolvedValueOnce(res({ orphaned: 1 }));
    await user.click(screen.getByRole('button', { name: /Short Friday/ }));
    await user.click(screen.getByRole('tab', { name: 'Fri' }));
    await user.click(screen.getByRole('button', { name: 'Remove row 8' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/1 timetable entry will be orphaned/i)).toBeInTheDocument();
    expect(vi.mocked(api.saveTemplateWithRemap).mock.calls.map((c) => c[3])).toEqual([true]);
    await user.click(within(dialog).getByRole('button', { name: 'Save anyway' }));
    expect(vi.mocked(api.saveTemplateWithRemap).mock.calls.map((c) => c[3])).toEqual([true, undefined]);
  });

  it('refuses when the dry run reports blocked entries', async () => {
    const user = setup();
    vi.mocked(api.saveTemplateWithRemap).mockResolvedValueOnce(res({ blocked: 2 }));
    await pickOption(user, screen.getByRole('combobox', { name: /^Type, row 1/ }), 'Activity');
    await user.type(screen.getByLabelText('Activity name in English, row 1'), 'Assembly');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/2 lessons sit in periods/i);
    expect(api.saveTemplateWithRemap).toHaveBeenCalledTimes(1);
  });

  it('ignores a dry run that finishes after another template was selected', async () => {
    const user = setup();
    let finish!: (r: SaveTemplateRes) => void;
    vi.mocked(api.saveTemplateWithRemap).mockReturnValueOnce(new Promise((r) => (finish = r)));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    await user.click(screen.getByRole('button', { name: /Primary/ }));
    finish(res({ orphaned: 2 }));
    await vi.waitFor(() => expect(api.saveTemplateWithRemap).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('re-runs the dry run when the draft changes while it is pending', async () => {
    const user = setup();
    let finish!: (r: SaveTemplateRes) => void;
    vi.mocked(api.saveTemplateWithRemap).mockReturnValueOnce(new Promise((r) => (finish = r)));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    fireEvent.change(screen.getByLabelText('Template name'), { target: { value: 'Renamed' } });
    finish(res({ orphaned: 1 }));
    await vi.waitFor(() => expect(api.saveTemplateWithRemap).toHaveBeenCalledTimes(3));
    const calls = vi.mocked(api.saveTemplateWithRemap).mock.calls;
    expect(calls.map((c) => c[3])).toEqual([true, true, undefined]);
    expect(calls[1]![2].name).toBe('Renamed');
    expect(calls[2]![2].name).toBe('Renamed');
  });

  it('saves through the callable after a clean dry run when the template is used', async () => {
    const user = setup();
    await pickOption(user, screen.getByRole('combobox', { name: /^Type, row 5/ }), 'Period');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    await vi.waitFor(() => expect(api.saveTemplateWithRemap).toHaveBeenCalledTimes(2));
    expect(vi.mocked(api.saveTemplateWithRemap).mock.calls.map((c) => c[3])).toEqual([true, undefined]);
  });

  it('saves through the callable without a dry run when no class uses the template', async () => {
    const unused = { ...ctx, classes: ctx.classes.filter((c) => c.templateId !== TPL.primary) };
    renderWithSchool(<TemplatesPage />, { ctx: unused, entries });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Primary/ }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(api.saveTemplateWithRemap).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.saveTemplateWithRemap).mock.calls[0]![3]).toBeUndefined();
  });

  it('adds a named activity row and saves it', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: /Primary/ }));
    await user.click(screen.getByRole('button', { name: '+ Activity' }));
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/name the activity/i);
    expect(api.saveTemplateWithRemap).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText('Activity name in English, row 8'), 'Assembly');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    await vi.waitFor(() => expect(api.saveTemplateWithRemap).toHaveBeenCalledTimes(2));
    const [, id, patch] = vi.mocked(api.saveTemplateWithRemap).mock.calls[1]!;
    expect(id).toBe(TPL.primary);
    expect(patch.rows.at(-1)).toMatchObject({ type: 'activity', nameEn: 'Assembly' });
  });

  it('shows the in-use message when the server refuses the real save', async () => {
    const user = setup();
    vi.mocked(api.saveTemplateWithRemap).mockResolvedValueOnce(res()).mockRejectedValueOnce(new ApiError('template-in-use', 'x', { count: 3 }));
    await pickOption(user, screen.getByRole('combobox', { name: /^Type, row 5/ }), 'Period');
    await user.click(screen.getByRole('button', { name: 'Save template' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/3 lessons sit in periods/i);
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
    expect(api.saveTemplateWithRemap).not.toHaveBeenCalled();
    expect(screen.getByText(/Row 1: enter a valid time/)).toBeInTheDocument();
  });

  it('read-only hides every write control', () => {
    flags.readOnly = true;
    setup();
    for (const name of ['Save template', '+ New template', 'Set as default', '+ Period', '+ Interval', '+ Activity', 'Delete template']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(screen.getByLabelText('Start, row 1')).toBeDisabled();
  });
});
