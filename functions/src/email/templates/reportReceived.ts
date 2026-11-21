// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { render, sathiyaHeader, type Rendered } from './layout';
import { siteFooter } from './footer';

export const REPORT_REASON_LABELS: Record<string, { en: string; si: string }> = {
  fake: { en: 'Fake school', si: 'ව්‍යාජ පාසලක්' },
  duplicate: { en: 'Duplicate registration', si: 'අනුපිටපත් ලියාපදිංචියක්' },
  abuse: { en: 'Abuse or misuse', si: 'අනිසි භාවිතයක්' },
  other: { en: 'Other', si: 'වෙනත්' },
};

export interface ReportReceivedInput {
  schoolName: string;
  schoolId: string;
  reason: string;
  details?: string;
  reporterEmail?: string;
  loginUrl: string;
  webUrl?: string;
}

export function reportReceived({ schoolName, schoolId, reason, details, reporterEmail, loginUrl, webUrl }: ReportReceivedInput): Rendered {
  const label = REPORT_REASON_LABELS[reason] ?? { en: reason, si: reason };
  return render({
    subject: `New report (${label.en}): ${schoolName}`,
    header: sathiyaHeader,
    en: {
      greeting: 'Hello,',
      paras: [
        ['A school was reported on Sathiya: ', { b: schoolName }, ` (${schoolId}).`],
        ['Reason: ', { b: label.en }, reporterEmail ? `. Reporter: ${reporterEmail}` : '. The reporter left no email address.'],
      ],
      quote: details,
      cta: { label: 'Open Sathiya', url: loginUrl },
    },
    si: {
      greeting: 'ආයුබෝවන්,',
      paras: [`Sathiya හි පාසලක් පිළිබඳ වාර්තාවක් ලැබී ඇත: ${schoolName}. හේතුව: ${label.si}.`],
    },
    footer: siteFooter(webUrl),
  });
}
