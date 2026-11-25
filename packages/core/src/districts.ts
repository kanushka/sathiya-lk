// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export const DISTRICTS = [
  'Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi',
  'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya',
] as const;

export type District = (typeof DISTRICTS)[number];

export const isDistrict = (v: unknown): v is District => (DISTRICTS as readonly unknown[]).includes(v);

const MOE_SPELLINGS: Readonly<Record<string, District>> = { Moneragala: 'Monaragala' };

export const canonicalDistrict = (d: string): string => MOE_SPELLINGS[d] ?? d;
