// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/firebase', () => ({ app: {}, auth: {}, db: {}, functions: {}, storage: {} }));
vi.mock('../features/superadmin/AnnouncementBanner', () => ({ AnnouncementBanner: () => <div data-testid="banner" /> }));
vi.mock('./Sidebar', () => ({ Sidebar: () => <nav /> }));
vi.mock('../app/SchoolProvider', () => ({
  useHasSchool: () => true,
  SchoolProvider: ({ children }: { children: React.ReactNode }) => children,
}));

const { AdminLayout, useReadOnly } = await import('./AdminLayout');

function Page() {
  return <p>{useReadOnly() ? 'read-only' : 'editable'}</p>;
}

function renderLayout(readOnly?: boolean) {
  render(
    <MemoryRouter initialEntries={['/x']}>
      <Routes>
        <Route element={<AdminLayout readOnly={readOnly} />}>
          <Route path="/x" element={<Page />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('useReadOnly', () => {
  it('is true under a read-only admin layout', () => {
    renderLayout(true);
    expect(screen.getByText('read-only')).toBeInTheDocument();
  });

  it('is false in the normal admin layout', () => {
    renderLayout();
    expect(screen.getByText('editable')).toBeInTheDocument();
  });
});

describe('announcement banner', () => {
  it('shows above the admin content', () => {
    renderLayout();
    expect(screen.getByTestId('banner')).toBeInTheDocument();
  });

  it('is skipped in the read-only super view', () => {
    renderLayout(true);
    expect(screen.queryByTestId('banner')).not.toBeInTheDocument();
  });
});
