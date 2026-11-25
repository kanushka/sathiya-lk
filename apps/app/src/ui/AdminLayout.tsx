// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { createContext, useContext } from 'react';
import { Outlet } from 'react-router-dom';
import { PendingBanner } from '../app/PendingReview';
import { SchoolProvider, useHasSchool } from '../app/SchoolProvider';
import { AnnouncementBanner } from '../features/superadmin/AnnouncementBanner';
import { PhoneTopBar } from './PhoneTopBar';
import { Sidebar } from './Sidebar';

export interface AdminLayoutProps {
  basePath?: string;
  readOnly?: boolean;
}

const ReadOnlyCtx = createContext(false);

export function useReadOnly(): boolean {
  return useContext(ReadOnlyCtx);
}

function Shell({ basePath, readOnly = false }: AdminLayoutProps) {
  return (
    <ReadOnlyCtx.Provider value={readOnly}>
      <div className="flex min-h-screen md:min-w-[1024px] flex-col bg-[#F6F6F4] font-sans text-ink">
        {!readOnly && <AnnouncementBanner />}
        {!readOnly && <PendingBanner />}
        <PhoneTopBar basePath={basePath} readOnly={readOnly} />
        <div className="flex flex-1">
          <div className="hidden md:block">
            <Sidebar basePath={basePath} readOnly={readOnly} />
          </div>
          <main className="min-w-0 flex-1 px-4 py-5 md:px-9 md:py-7">
            <Outlet />
          </main>
        </div>
      </div>
    </ReadOnlyCtx.Provider>
  );
}

export function AdminLayout(props: AdminLayoutProps) {
  const hasSchool = useHasSchool();
  if (hasSchool) return <Shell {...props} />;
  return (
    <SchoolProvider>
      <Shell {...props} />
    </SchoolProvider>
  );
}
