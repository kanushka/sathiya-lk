// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { C, ctx, entry, S, T } from '@sathiya/core/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { OutsideTemplateList } from './OutsideTemplateList';

const orphan = entry('o', 4, 8, [C.c6c], [[S.science, T.gunasekara]]);

describe('OutsideTemplateList', () => {
  it('renders nothing without entries', () => {
    const { container } = renderWithSchool(<OutsideTemplateList entries={[]} onDelete={vi.fn()} />, { ctx });
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each entry with day, period, subject and teacher', () => {
    renderWithSchool(<OutsideTemplateList entries={[orphan]} onDelete={vi.fn()} />, { ctx });
    const section = screen.getByRole('region', { name: 'Outside the period template' });
    expect(section).toHaveAttribute('id', 'outside-template');
    const item = within(section).getByRole('listitem');
    expect(item).toHaveTextContent('Fri P8');
    expect(item).toHaveTextContent('6C');
    expect(item).toHaveTextContent('Science');
    expect(item).toHaveTextContent('Mrs. S. Gunasekara');
  });

  it('deletes an entry only after confirming', async () => {
    const onDelete = vi.fn().mockResolvedValue(true);
    renderWithSchool(<OutsideTemplateList entries={[orphan]} onDelete={onDelete} />, { ctx });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Fri P8 Science' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this entry?' });
    expect(dialog).toHaveTextContent('Fri P8 · 6C · Science');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delete Fri P8 Science' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalledWith('o');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the dialog open when the delete fails', async () => {
    const onDelete = vi.fn().mockResolvedValue(false);
    renderWithSchool(<OutsideTemplateList entries={[orphan]} onDelete={onDelete} />, { ctx });
    await userEvent.click(screen.getByRole('button', { name: 'Delete Fri P8 Science' }));
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(onDelete).toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('hides delete when read-only', () => {
    renderWithSchool(<OutsideTemplateList entries={[orphan]} onDelete={vi.fn()} readOnly />, { ctx });
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });
});
