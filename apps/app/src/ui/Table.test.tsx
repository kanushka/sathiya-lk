// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TBody, THead, Table, Td, Th, Tr } from './Table';

function People({ names, empty = false }: { names: string[]; empty?: boolean }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Name</Th>
          <Th>Grades</Th>
          <Th />
        </Tr>
      </THead>
      <TBody>
        {empty && (
          <Tr>
            <Td colSpan={3}>Nobody yet</Td>
          </Tr>
        )}
        {names.map((n) => (
          <Tr key={n}>
            <Td>{n}</Td>
            <Td>6, 7</Td>
            <Td>
              <button>Edit {n}</button>
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

describe('Table', () => {
  it('copies header labels onto cells', () => {
    render(<People names={['Silva']} />);
    expect(screen.getByText('Silva')).toHaveAttribute('data-label', 'Name');
    expect(screen.getByText('6, 7')).toHaveAttribute('data-label', 'Grades');
  });

  it('leaves cells under an empty header unlabelled', () => {
    render(<People names={['Silva']} />);
    expect(screen.getByRole('button', { name: 'Edit Silva' }).parentElement).not.toHaveAttribute('data-label');
  });

  it('labels rows added after mount', () => {
    const { rerender } = render(<People names={['Silva']} />);
    rerender(<People names={['Silva', 'Perera']} />);
    expect(screen.getByText('Perera')).toHaveAttribute('data-label', 'Name');
  });

  it('skips rows with a colSpan cell', () => {
    render(<People names={[]} empty />);
    expect(screen.getByText('Nobody yet')).not.toHaveAttribute('data-label');
  });

  it('turns rows into cards below md and keeps the table from md up', () => {
    const { container } = render(<People names={['Silva']} />);
    const wrap = container.firstElementChild!;
    expect(wrap).toHaveClass('phone-cards', 'overflow-x-auto');
  });

  it('no table keeps a fixed minimum width below md', () => {
    const sources = import.meta.glob('../**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const offenders = Object.entries(sources)
      .filter(([, src]) => /<Table className="[^"]*(?<!md:)min-w-\[/.test(src))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
