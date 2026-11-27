// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { teacherDisplayName, type Lang, type SchoolClass, type Teacher } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { ListInitials, ListRow, ListSection } from '../../ui/GroupedList';

/** "6–11" for a run of grades, "1, 3" otherwise. */
export function gradeRange(grades: number[]): string {
  const sorted = [...grades].sort((a, b) => a - b);
  if (sorted.length > 2 && sorted.every((g, i) => i === 0 || g === (sorted[i - 1] ?? 0) + 1)) return `${sorted[0]}–${sorted[sorted.length - 1]}`;
  return sorted.join(', ');
}

export interface TeachersPhoneListProps {
  rows: Teacher[];
  classes: SchoolClass[];
  subjectName: Map<string, string>;
  loadText: (x: Teacher) => string;
  readOnly: boolean;
  linkLocked: boolean;
  busy: string | null;
  onOpen: (x: Teacher) => void;
  onLink: (x: Teacher) => void;
}

export function TeachersPhoneList({ rows, classes, subjectName, loadText, readOnly, linkLocked, busy, onOpen, onLink }: TeachersPhoneListProps) {
  const { t, i18n } = useTranslation('teachers');
  const lang = i18n.language as Lang;

  const detail = (x: Teacher) => {
    const cts = classes.filter((c) => c.classTeacherId === x.id).map((c) => c.name);
    const rest = [
      x.isPrimary ? t('page.primaryTeacher') : x.subjectIds.map((id) => subjectName.get(id) ?? id).join(', '),
      x.grades.length > 0 && t('phone.grades', { grades: gradeRange(x.grades) }),
      cts.length > 0 && t('phone.classTeacher', { classes: cts.join(', ') }),
      t('phone.load', { load: loadText(x) }),
    ]
      .filter(Boolean)
      .join(' · ');
    return (
      <>
        <span className="font-mono text-xs">{x.staffId}</span> · {rest}
      </>
    );
  };

  const row = (x: Teacher) => {
    const name = teacherDisplayName(x, lang);
    return (
      <ListRow
        key={x.id}
        lead={<ListInitials name={name} />}
        title={name}
        detail={detail(x)}
        onOpen={() => onOpen(x)}
        openLabel={t('phone.editFor', { name })}
        action={
          !readOnly && !x.uid
            ? {
                label: t('phone.link'),
                ariaLabel: t('phone.linkFor', { name }),
                loading: busy === `link:${x.id}`,
                disabled: busy !== null || linkLocked,
                describedBy: linkLocked ? 'personal-links-locked' : undefined,
                onClick: () => onLink(x),
              }
            : undefined
        }
      />
    );
  };

  const notLinked = rows.filter((x) => !x.uid);
  const linked = rows.filter((x) => x.uid);
  return (
    <>
      {notLinked.length > 0 && (
        <ListSection title={t('phone.notLinked')} count={notLinked.length}>
          {notLinked.map(row)}
        </ListSection>
      )}
      {linked.length > 0 && (
        <ListSection title={t('phone.linked')} count={linked.length} tone="success">
          {linked.map(row)}
        </ListSection>
      )}
    </>
  );
}
