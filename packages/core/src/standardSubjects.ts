// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DefaultSubject } from './types';

const s = (nameEn: string, nameSi: string, short: string, color: string): DefaultSubject => ({ nameEn, nameSi, short, color });

export const STANDARD_SUBJECTS: readonly DefaultSubject[] = [
  s('Sinhala', 'සිංහල', 'Sin', '#F2E2E7'),
  s('Tamil', 'දෙමළ', 'Tam', '#F0E6DA'),
  s('English', 'ඉංග්‍රීසි', 'Eng', '#E3E9D2'),
  s('Mathematics', 'ගණිතය', 'Math', '#D4ECEA'),
  s('Science', 'විද්‍යාව', 'Sci', '#DCE7FA'),
  s('History', 'ඉතිහාසය', 'Hist', '#EFE3D3'),
  s('Geography', 'භූගෝල විද්‍යාව', 'Geo', '#E2EEE0'),
  s('Civic Education', 'පුරවැසි අධ්‍යාපනය', 'Civ', '#E2EEE0'),
  s('Health & Physical Education', 'සෞඛ්‍ය හා ශාරීරික අධ්‍යාපනය', 'HPE', '#DDEFF2'),
  s('Buddhism', 'බුද්ධ ධර්මය', 'Bud', '#FBEAC9'),
  s('Hinduism', 'හින්දු ධර්මය', 'Hin', '#FBEAC9'),
  s('Islam', 'ඉස්ලාම් ධර්මය', 'Isl', '#FBEAC9'),
  s('Catholicism', 'කතෝලික ධර්මය', 'Cath', '#FBEAC9'),
  s('Christianity', 'ක්‍රිස්තු ධර්මය', 'Chr', '#FBEAC9'),
  s('Art', 'චිත්‍ර', 'Art', '#EBDDF2'),
  s('Eastern Music', 'පෙරදිග සංගීතය', 'EMus', '#EBDDF2'),
  s('Western Music', 'අපරදිග සංගීතය', 'WMus', '#EBDDF2'),
  s('Dancing', 'නර්තනය', 'Dnc', '#EBDDF2'),
  s('Drama & Theatre', 'නාට්‍ය හා රංග කලාව', 'Dra', '#EBDDF2'),
  s('Practical & Technical Skills', 'ප්‍රායෝගික හා තාක්ෂණික කුසලතා', 'PTS', '#E9E9E9'),
  s('Information & Communication Technology', 'තොරතුරු හා සන්නිවේදන තාක්ෂණය', 'ICT', '#DDEFF2'),
  s('Business & Accounting Studies', 'ව්‍යාපාර හා ගිණුම්කරණ අධ්‍යයනය', 'BAS', '#EFE3D3'),
  s('Agriculture', 'කෘෂිකර්මය', 'Agri', '#E2EEE0'),
  s('Home Economics', 'ගෘහ ආර්ථික විද්‍යාව', 'HE', '#F0E6DA'),
  s('Sinhala Literature', 'සිංහල සාහිත්‍යය', 'SLit', '#F2E2E7'),
  s('English Literature', 'ඉංග්‍රීසි සාහිත්‍යය', 'ELit', '#E3E9D2'),
  s('Pali', 'පාලි', 'Pali', '#FBEAC9'),
];
