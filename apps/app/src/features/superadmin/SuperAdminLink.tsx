// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { Icon } from '../../ui/Icon';

export function SuperAdminLink({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { t } = useTranslation('superadmin');
  const { claims } = useAuth();
  if (!claims?.super) return null;
  return (
    <Link
      to="/super"
      className={className}
      aria-label={compact ? t('adminLink') : undefined}
      title={compact ? t('adminLink') : undefined}
    >
      {compact ? <Icon name="profile" size={20} /> : t('adminLink')}
    </Link>
  );
}
