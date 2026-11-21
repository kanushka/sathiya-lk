import { C, ctx, entries6B } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { SubjectProgress } from './SubjectProgress';

const cls6B = ctx.classes.find((c) => c.id === C.c6b)!;
const row = (name: string) => screen.getByText(name).closest('li')!;

describe('SubjectProgress', () => {
  it('shows placed/needed per plan item and the week total', () => {
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} />, { ctx, entries: entries6B });
    expect(screen.getByRole('heading', { name: '6B subjects' })).toBeInTheDocument();
    expect(row('Mathematics')).toHaveTextContent('6/6');
    expect(row('Science')).toHaveTextContent('3/5');
    expect(row('Religion')).toHaveTextContent('3/3');
    expect(screen.getByText('36')).toBeInTheDocument();
    expect(screen.getByText('/ 40 placed')).toBeInTheDocument();
  });

  it('renders a bar per item filled to the placed share', () => {
    renderWithSchool(<SubjectProgress cls={cls6B} entries={entries6B} />, { ctx, entries: entries6B });
    expect(row('Science').querySelector('[data-bar]')).toHaveStyle({ width: '60%' });
    expect(row('Mathematics').querySelector('[data-bar]')).toHaveStyle({ width: '100%' });
  });
});
