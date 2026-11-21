import { Outlet } from 'react-router-dom';
import { SchoolProvider, useHasSchool } from '../app/SchoolProvider';
import { Sidebar } from './Sidebar';

export interface AdminLayoutProps {
  basePath?: string;
  readOnly?: boolean;
}

function Shell({ basePath, readOnly }: AdminLayoutProps) {
  return (
    <div className="flex min-h-screen min-w-[1024px] bg-[#F6F6F4] font-sans text-ink">
      <Sidebar basePath={basePath} readOnly={readOnly} />
      <main className="min-w-0 flex-1 px-9 py-7">
        <Outlet />
      </main>
    </div>
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
