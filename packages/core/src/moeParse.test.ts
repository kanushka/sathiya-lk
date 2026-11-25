// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseAllSchools, parseNationalSchools } from './moeParse';

const fixture = (f: string) => readFileSync(new URL(`../../../scripts/moe-schools/fixtures/${f}`, import.meta.url), 'utf8');

describe('parseAllSchools', () => {
  const rows = parseAllSchools(fixture('all-schools.txt'));
  const by = (no: string) => rows.find((r) => r.censusNo === no);

  it('skips headers and parses every row', () => {
    expect(rows).toHaveLength(18);
    expect(rows[0]?.name).toBe('MODARA DE LA SALLE COLLEGE');
    expect(rows.every((r) => /^\d{5}$/.test(r.censusNo))).toBe(true);
  });

  it('strips numeric prefixes and keeps leading zeros', () => {
    expect(by('00001')).toEqual({
      censusNo: '00001',
      name: 'MODARA DE LA SALLE COLLEGE',
      address: 'MODARA, COLOMBO 15',
      level: 'Provincial',
      span: 'Grd 1-13',
      medium: 'S',
      sex: 'Boys',
    });
    expect(by('00005')).toMatchObject({ medium: 'S/T', sex: 'Mixed', span: 'Grd 1-11' });
  });

  it('reads address on the line after the name', () => {
    expect(by('00002')).toMatchObject({ name: 'MODARA ANANDA M.M.V.', address: 'SRI PANCHANANDA MW, MODARA, COLOMBO 15' });
  });

  it('joins a name wrapped across lines around the census number', () => {
    expect(by('00074')).toMatchObject({
      name: 'COLOMBO SIRIMAVO BANDARANAYAKE BALIKA VIDYALAYA',
      address: 'COLOMBO 07',
      level: 'National',
      medium: 'S/E',
      sex: 'Girls',
    });
  });

  it('splits a long name from its address on a single line', () => {
    expect(by('03613')).toMatchObject({ name: 'NAWALAPITIYA KATHIRESAN CENTRAL COLLEGE', address: 'KOTMALE RD, NAWALAPITIYA', medium: 'T/E' });
  });

  it('handles name and address both wrapped', () => {
    expect(by('09022')).toMatchObject({ name: 'PUNGUDUTIVU RAJARAJESWARY TAMIL MIXED VIDYALAYAM', address: 'WARD NO 10 PUNGUDUTIVU' });
  });

  it('keeps the town in the name when the PDF leaves the address column empty', () => {
    expect(by('03412')).toMatchObject({ name: 'ERIYAGAMA SRI PUSHPADANA MODEL SCHOOL PERADANIYA', address: '' });
  });

  it('currently misplaces address text on a wrapped row with the census number alone (13148)', () => {
    const text = readFileSync(new URL('../../../scripts/moe-schools/fixtures/all-schools-13148.txt', import.meta.url), 'utf8');
    const row = parseAllSchools(text).find((r) => r.censusNo === '13148');
    expect(row).toMatchObject({
      name: 'KATKARANKULAM, KANTHINAGAR, KATKARANKULAM ILANGO VIDYALAYAM',
      address: 'CHEDDIKULAM.',
    });
  });

  it('falls back to the previous page address column, and throws without one', () => {
    const good = ' 00001      SCHOOL ONE                          MAIN RD, TOWN              Provincial   1.Grd 1-5    1.S       3.Mixed';
    const bare = '00002\n        SCHOOL TWO              ROAD TWO                       Provincial   1.Grd 1-5    1.S       3.Mixed';
    expect(parseAllSchools(`${good}\n\f${bare}`).map((r) => r.censusNo)).toEqual(['00001', '00002']);
    expect(() => parseAllSchools(bare)).toThrow(/address column/);
  });

  it('throws on a census number that is not 4-6 digits', () => {
    const bad = ' 1234567   SOME SCHOOL            SOME ROAD            Provincial   3.Grd 1-11   1.S       3.Mixed\n';
    expect(() => parseAllSchools(bad)).toThrow(/4-6 digits/);
  });
});

describe('parseNationalSchools', () => {
  const rows = parseNationalSchools(fixture('national-schools.txt'));
  const by = (no: string) => rows.find((r) => r.censusNo === no);

  it('parses a plain row', () => {
    expect(by('00023')).toEqual({
      censusNo: '00023',
      name: 'KOTAHENA M.M.V.',
      address: 'MAHA VIDYALA MW, COLOMBO 13',
      province: 'Western',
      district: 'Colombo',
      zone: 'Colombo',
    });
  });

  it('prepends an address line that wraps above the row', () => {
    expect(by('00050')).toMatchObject({ name: 'COLOMBO ANANDA B.V.', address: 'REV. HIKKADUWA SRI SUMANGALA NAHIMI MW, COLOMBO 10' });
  });

  it('copes with an address running into the province column', () => {
    expect(by('00131')).toMatchObject({ address: 'KUDA BUTHGAMUWA, MULLERIYAWA NEW TOWN', zone: 'Sri Jayawardenapura' });
  });
});
