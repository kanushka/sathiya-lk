// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useParams } from 'react-router-dom';

export function useAdminBase(): string {
  const { sid } = useParams();
  return sid ? `/s/${sid}` : '/admin';
}
