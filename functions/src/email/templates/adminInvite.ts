// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { pickName } from '@sathiya/core';
import { render, schoolHeader, type Rendered, type SchoolBrand } from './layout';

export interface AdminInviteInput {
  inviter: string;
  school: SchoolBrand;
  loginUrl: string;
  webUrl?: string;
}

export function adminInvite({ inviter, school, loginUrl }: AdminInviteInput): Rendered {
  const si = pickName(school, 'si');
  return render({
    subject: `You're invited to manage ${pickName(school, 'en')} on Sathiya`,
    header: schoolHeader(school),
    en: {
      greeting: 'Hello,',
      paras: [[{ b: inviter }, ' invited you to be an admin of ', { b: pickName(school, 'en') }, ' on Sathiya, where the school builds its timetables.']],
      cta: { label: 'Accept invite', url: loginUrl },
      note: 'Sign in with this email address (Google or password). The invite is waiting for you.',
    },
    si: {
      greeting: 'ආයුබෝවන්,',
      paras: [`${si} පාසලේ Sathiya පරිපාලකයෙකු ලෙස එක්වීමට ${inviter} ඔබට ආරාධනා කර ඇත. ඉහත බොත්තම ඔබන්න.`],
    },
    footer: { en: `Sent by Sathiya for ${pickName(school, 'en')}. Not expecting this? Ignore it.` },
  });
}
