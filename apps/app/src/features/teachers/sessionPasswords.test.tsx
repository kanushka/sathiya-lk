// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { clearSessionPasswords, setSessionPassword, useSessionPasswords } from './sessionPasswords';

function Probe() {
  const { passwords } = useSessionPasswords();
  return <p data-testid="probe">{passwords.t1 ?? 'none'}</p>;
}

const other = { ...ctx, school: { ...ctx.school, id: 'other-school' } };

beforeEach(() => clearSessionPasswords());

describe('session passwords', () => {
  it('are scoped to user and school and dropped when the scope changes', () => {
    setSessionPassword('test-user:siripura', 't1', 'abcd2345');
    const first = renderWithSchool(<Probe />, { ctx });
    expect(screen.getByTestId('probe')).toHaveTextContent('abcd2345');
    first.unmount();

    const second = renderWithSchool(<Probe />, { ctx: other });
    expect(screen.getByTestId('probe')).toHaveTextContent('none');
    second.unmount();

    renderWithSchool(<Probe />, { ctx });
    expect(screen.getByTestId('probe')).toHaveTextContent('none');
  });
});
