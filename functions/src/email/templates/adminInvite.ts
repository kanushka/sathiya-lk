// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { BRAND_NAME, render, schoolFooter, schoolHeader, type Rendered, type SchoolBrand } from './layout';

export interface AdminInviteInput {
  inviter: string;
  school: SchoolBrand;
  loginUrl: string;
  webUrl?: string;
}

export function adminInvite({ inviter, school, loginUrl }: AdminInviteInput): Rendered {
  const name = pickName(school, 'en');
  const si = pickName(school, 'si');
  return render({
    subject: `Join ${name} on ${BRAND_NAME}`,
    header: schoolHeader(school),
    en: {
      title: "You're invited to be an admin",
      paras: [[{ b: inviter }, ' invited you to help manage ', { b: name }, ' on Sathiya, where the school builds its timetables.']],
      cta: { label: 'Accept invite', url: loginUrl },
      note: 'Sign in with this email address, with Google or a password. The invite waits for you.',
    },
    si: {
      title: 'පරිපාලකයෙකු ලෙස එක්වන්න',
      paras: [`${si} පාසලේ Sathiya පරිපාලකයෙකු ලෙස එක්වීමට ${inviter} ඔබට ආරාධනා කර ඇත. ඉහත බොත්තම ඔබන්න.`],
    },
    footer: schoolFooter(school, 'Not expecting this? Ignore it.'),
  });
}
