// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export interface SlipLabels {
  staffId: string;
  password: string;
  resetNeeded: string;
  loginAt: string;
}

export interface SlipData {
  schoolName: string;
  staffId: string;
  name: string;
  password?: string;
  url: string;
}

export function teacherLoginUrl(origin: string, schoolId: string): string {
  return `${origin}/login?as=teacher&school=${encodeURIComponent(schoolId)}`;
}

export function slipText(slip: SlipData, labels: SlipLabels): string {
  return [
    slip.schoolName,
    slip.name,
    `${labels.staffId}: ${slip.staffId}`,
    `${labels.password}: ${slip.password ?? labels.resetNeeded}`,
    `${labels.loginAt}: ${slip.url}`,
  ].join('\n');
}

export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
