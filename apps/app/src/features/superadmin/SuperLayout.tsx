import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { cx } from '../../ui/cx';

interface NavItem {
  to: string;
  labelKey: string;
  end?: boolean;
}

export const superNav: NavItem[] = [
  { to: '/super', labelKey: 'nav.schools', end: true },
  { to: '/super/usage', labelKey: 'nav.usage' },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cx(
    'block rounded-lg px-3 py-2 text-sm font-medium text-[#C9D1E3] hover:bg-white/5',
    isActive && 'bg-white/10 font-bold text-white',
  );

export function SuperLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation('superadmin');
  const { claims } = useAuth();
  const isAdmin = claims?.role === 'admin' && !!claims.sid;
  return (
    <div className="flex min-h-screen bg-ground font-sans text-ink">
      <aside className="w-[230px] shrink-0 bg-navy px-3.5 py-5">
        <div className="px-2 pb-[18px]">
          <strong className="block text-white">{t('brand')}</strong>
          <span className="text-xs font-bold text-saffron">{t('role')}</span>
        </div>
        <nav aria-label={t('nav.label')}>
          <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
            {superNav.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className={linkClass}>
                  {t(item.labelKey)}
                </NavLink>
              </li>
            ))}
            {isAdmin && (
              <li className="mt-4 border-t border-white/10 pt-3">
                <NavLink to="/admin" className={linkClass}>
                  {t('nav.schoolAdmin')}
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
      </aside>
      <main className="min-w-0 flex-1 px-9 py-7">{children}</main>
    </div>
  );
}
