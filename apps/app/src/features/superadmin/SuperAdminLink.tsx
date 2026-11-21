// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';

export function SuperAdminLink({ className }: { className?: string }) {
  const { t } = useTranslation('superadmin');
  const { claims } = useAuth();
  if (!claims?.super) return null;
  return (
    <Link to="/super" className={className}>
      {t('adminLink')}
    </Link>
  );
}
