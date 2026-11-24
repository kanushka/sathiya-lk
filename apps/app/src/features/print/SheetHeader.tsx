// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName } from '@sathiya/core';

interface Props {
  schoolName: { nameEn: string; nameSi?: string };
  logoUrl?: string;
  title: string;
  subtitle: string;
}

export function SheetHeader({ schoolName, logoUrl, title, subtitle }: Props) {
  return (
    <header style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 14, borderBottom: '3px solid var(--brand)' }}>
      {logoUrl && <img data-testid="school-logo" src={logoUrl} alt="" width={56} height={56} style={{ objectFit: 'contain' }} />}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{pickName(schoolName, 'en')}</p>
        {schoolName.nameEn.trim() && schoolName.nameSi && <p className="text-ink-soft" style={{ margin: '2px 0 0', fontSize: 14 }}>{schoolName.nameSi}</p>}
      </div>
      <div style={{ textAlign: 'right' }}>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: 'var(--brand)', lineHeight: 1 }}>{title}</h1>
        <p className="text-ink-soft" style={{ margin: '4px 0 0', fontSize: 13 }}>{subtitle}</p>
      </div>
    </header>
  );
}
