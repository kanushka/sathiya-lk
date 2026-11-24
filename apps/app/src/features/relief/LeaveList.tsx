// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { LEAVE_TYPES, toMinutes, type DayIndex, type Leave, type LeaveType, type Relief, type Teacher, type TeacherSnapshot } from '@sathiya/core';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Checkbox } from '../../ui/Checkbox';
import { ToggleChip } from '../../ui/Chip';
import { Combobox } from '../../ui/Combobox';
import { IconButton } from '../../ui/IconButton';
import type { Names } from './model';

export interface LeaveListProps {
  leaves: Leave[];
  reliefs: Relief[];
  snaps: Map<string, TeacherSnapshot>;
  day: DayIndex;
  names: Names;
  readOnly: boolean;
  addable: Teacher[];
  onAdd(teacherId: string): void;
  onType(teacherId: string, type: LeaveType): void;
  onTick(teacherId: string, entryId: string, on: boolean): void;
  onRemove(teacherId: string): void;
}

export function LeaveList({ leaves, reliefs, snaps, day, names, readOnly, addable, onAdd, onType, onTick, onRemove }: LeaveListProps) {
  const { t } = useTranslation('relief');

  return (
    <section aria-labelledby="relief-leave-title" className="rounded-[14px] border border-line-soft bg-white p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 id="relief-leave-title" className="m-0 text-[17px] font-bold text-ink">
          {readOnly ? t('leave.titlePast') : t('leave.title')}
        </h2>
        {!readOnly && (
          <Combobox
            items={addable}
            getKey={(x) => x.id}
            getLabel={(x) => names.teacher(x.id)}
            onChange={(x) => onAdd(x.id)}
            placeholder={`+ ${t('leave.add')}`}
            searchPlaceholder={t('leave.search')}
            className="w-full sm:w-64"
          />
        )}
      </div>

      {leaves.length === 0 ? (
        <p className="m-0 text-sm text-ink-muted">{readOnly ? t('leave.nonePast') : t('leave.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {leaves.map((leave) => {
            const name = names.teacher(leave.teacherId);
            const cells = (snaps.get(leave.teacherId)?.cells ?? [])
              .filter((c) => c.day === day && c.entryId !== undefined)
              .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
            const ticked = new Set(leave.entryIds);
            const past = reliefs.filter((r) => r.absentTeacherId === leave.teacherId);
            return (
              <li key={leave.teacherId} role="group" aria-label={name} className="border-t border-line-soft py-3 first:border-t-0 first:pt-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="block text-[15px] text-ink">{name}</strong>
                    {readOnly && <Badge className="mt-1">{t(`types.${leave.type}`)}</Badge>}
                  </div>
                  {!readOnly && (
                    <IconButton icon="close" size="sm" label={t('leave.remove', { name })} onClick={() => onRemove(leave.teacherId)} />
                  )}
                </div>
                {!readOnly && (
                  <div role="group" aria-label={t('leave.type')} className="mt-2 flex flex-wrap gap-1.5">
                    {LEAVE_TYPES.map((type) => (
                      <ToggleChip key={type} pressed={leave.type === type} onToggle={() => onType(leave.teacherId, type)}>
                        {t(`types.${type}`)}
                      </ToggleChip>
                    ))}
                  </div>
                )}
                {(readOnly ? past : cells).length === 0 ? (
                  <p className="mb-0 mt-2 text-[13px] text-ink-muted">{t('leave.noLessons')}</p>
                ) : readOnly ? (
                  <ul className="mb-0 mt-2 flex list-none flex-col gap-1 p-0 text-[13px] text-ink-soft">
                    {past.map((r) => (
                      <li key={r.entryId}>{names.lesson(r)}</li>
                    ))}
                  </ul>
                ) : (
                  <fieldset className="m-0 mt-3 border-0 p-0">
                    <legend className="mb-1.5 p-0 text-xs font-semibold text-ink-muted">{t('leave.lessons')}</legend>
                    <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                      {cells.map((c) => (
                        <Checkbox
                          key={c.entryId}
                          checked={ticked.has(c.entryId!)}
                          onChange={(on) => onTick(leave.teacherId, c.entryId!, on)}
                          label={names.lesson(c)}
                          className="min-h-8 items-center"
                        />
                      ))}
                    </div>
                  </fieldset>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
