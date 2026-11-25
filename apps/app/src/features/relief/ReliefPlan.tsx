// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { LEAVE_TYPES, toMinutes, type Candidate, type DayIndex, type Leave, type LeaveType, type Relief, type Teacher, type TeacherSnapshot } from '@sathiya/core';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '../../ui/Badge';
import { Button, focusRingClass } from '../../ui/Button';
import { Checkbox } from '../../ui/Checkbox';
import { Combobox } from '../../ui/Combobox';
import { cx } from '../../ui/cx';
import { fieldBaseClass } from '../../ui/Field';
import { Icon } from '../../ui/Icon';
import { IconButton } from '../../ui/IconButton';
import { SegmentedControl } from '../../ui/SegmentedControl';
import { Select } from '../../ui/Select';
import { reliefKey, type Names } from './model';
import { ReliefPicker } from './ReliefPicker';

export interface ReliefPlanProps {
  leaves: Leave[];
  reliefs: Relief[];
  gone?: Relief[];
  snaps: Map<string, TeacherSnapshot>;
  day: DayIndex;
  names: Names;
  readOnly: boolean;
  addable: Teacher[];
  candidatesOf(index: number): Candidate[];
  errorsOf(r: Relief): string[];
  status(r: Relief): ReactNode;
  onAdd(teacherId: string): void;
  onType(teacherId: string, type: LeaveType): void;
  onTick(teacherId: string, entryId: string, on: boolean): void;
  onRemove(teacherId: string): void;
  onPick(index: number, teacherId: string | null): void;
  onSuggest(): void;
}

function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => w && !/^(mr|mrs|ms|miss|dr|rev|prof)\.?$/i.test(w));
  return words.slice(-2).map((w) => Array.from(w)[0]!.toUpperCase()).join('');
}

export function ReliefPlan(props: ReliefPlanProps) {
  const { leaves, reliefs, gone = [], snaps, day, names, readOnly, addable, candidatesOf, errorsOf, status, onAdd, onType, onTick, onRemove, onPick, onSuggest } = props;
  const { t } = useTranslation('relief');
  const [open, setOpen] = useState<number | null>(null);
  const openRelief = open === null ? undefined : reliefs[open];
  const indexOf = new Map(reliefs.map((r, i) => [reliefKey(r), i]));

  function picker(i: number) {
    const r = reliefs[i]!;
    const lesson = names.lesson(r);
    const tid = r.reliefTeacherId;
    const picked = tid === null ? t('reliefs.uncovered') : names.teacher(tid);
    const unavailable = !readOnly && tid !== null && !candidatesOf(i).some((c) => c.teacherId === tid);
    const errors = errorsOf(r);
    return (
      <div className="flex min-w-0 flex-col gap-1 sm:w-80 sm:shrink-0">
        {readOnly ? (
          <span className={cx('text-sm font-semibold', tid === null ? 'text-warning' : 'text-ink')}>{picked}</span>
        ) : (
          <button
            type="button"
            aria-label={`${t('reliefs.pickFor', { lesson })}: ${picked}`}
            aria-haspopup="dialog"
            aria-invalid={errors.length > 0 || unavailable || undefined}
            onClick={() => setOpen(i)}
            className={cx(
              fieldBaseClass,
              focusRingClass,
              'flex h-10 items-center gap-2 text-left',
              tid === null && 'border-warning-line bg-warning-soft/40',
            )}
          >
            {tid === null && <Icon name="minus" size={16} className="shrink-0 text-warning" />}
            <span className={cx('min-w-0 flex-1 truncate', tid === null && 'font-semibold text-warning')}>{picked}</span>
            <Icon name="chevronDown" size={16} className="shrink-0 text-ink-muted" />
          </button>
        )}
        {(unavailable || status(r)) && (
          <span className="flex flex-wrap gap-1.5">
            {unavailable && <Badge tone="danger">{t('reliefs.notAvailable')}</Badge>}
            {status(r)}
          </span>
        )}
        {errors.map((e) => (
          <span key={e} className="text-[13px] font-semibold text-danger">
            {e}
          </span>
        ))}
      </div>
    );
  }

  function lessonRows(leave: Leave) {
    if (readOnly) {
      const past = reliefs.filter((r) => r.absentTeacherId === leave.teacherId);
      if (past.length === 0) return <p className="m-0 px-4 pb-4 text-[13px] text-ink-muted sm:pl-16">{t('leave.noLessons')}</p>;
      return (
        <ul className="m-0 list-none p-0 pb-2">
          {past.map((r) => (
            <li key={reliefKey(r)} className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:gap-4 sm:pl-16">
              <span className="min-w-0 flex-1 text-sm font-semibold text-ink">{names.lesson(r)}</span>
              {picker(indexOf.get(reliefKey(r))!)}
            </li>
          ))}
        </ul>
      );
    }
    const cells = (snaps.get(leave.teacherId)?.cells ?? [])
      .filter((c) => c.day === day && c.entryId !== undefined)
      .sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    if (cells.length === 0) return <p className="m-0 px-4 pb-4 text-[13px] text-ink-muted sm:pl-16">{t('leave.noLessons')}</p>;
    const ticked = new Set(leave.entryIds);
    return (
      <ul aria-label={t('leave.lessons')} className="m-0 list-none p-0 pb-2">
        {cells.map((c) => {
          const on = ticked.has(c.entryId!);
          const i = indexOf.get(reliefKey({ entryId: c.entryId!, absentTeacherId: leave.teacherId }));
          return (
            <li key={c.entryId} className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:gap-4 sm:pl-16">
              <Checkbox
                checked={on}
                onChange={(next) => onTick(leave.teacherId, c.entryId!, next)}
                label={<span className={cx('font-semibold', !on && 'text-ink-muted')}>{names.lesson(c)}</span>}
                className="min-h-8 min-w-0 flex-1 items-center"
              />
              {on && i !== undefined ? picker(i) : <span className="text-[13px] text-ink-muted sm:w-80 sm:shrink-0">{t('leave.noRelief')}</span>}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section aria-labelledby="relief-plan-title" className="min-w-0 overflow-hidden rounded-[14px] border border-line-soft bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-white px-4 py-4 md:px-5">
        <div className="min-w-0">
          <h2 id="relief-plan-title" className="m-0 text-[17px] font-bold text-ink">
            {readOnly ? t('leave.titlePast') : t('leave.title')}
          </h2>
          {!readOnly && leaves.length > 0 && <p className="mb-0 mt-0.5 text-[13px] text-ink-muted">{t('leave.hint')}</p>}
        </div>
        {!readOnly && (
          <Button variant="secondary" size="sm" onClick={onSuggest} disabled={reliefs.length === 0}>
            <Icon name="sparkle" size={16} />
            {t('reliefs.suggest')}
          </Button>
        )}
      </div>

      {leaves.length === 0 ? (
        <p className="m-0 px-4 py-5 text-sm text-ink-muted md:px-5">{readOnly ? t('leave.nonePast') : t('leave.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-3 md:p-4">
          {leaves.map((leave) => {
            const name = names.teacher(leave.teacherId);
            const count = readOnly ? reliefs.filter((r) => r.absentTeacherId === leave.teacherId).length : leave.entryIds.length;
            return (
              <li key={leave.teacherId} role="group" aria-label={name} className="rounded-xl border border-line-soft bg-white">
                <div className="flex flex-wrap items-center gap-3 px-4 pb-2 pt-3">
                  <span aria-hidden="true" className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-xs font-bold text-brand">
                    {initials(name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <strong className="block truncate text-[15px] text-ink">{name}</strong>
                    <span className="text-xs text-ink-muted">{t('leave.lessonCount', { count })}</span>
                  </div>
                  {readOnly ? (
                    <Badge>{t(`types.${leave.type}`)}</Badge>
                  ) : (
                    <>
                      <span className="hidden sm:block">
                        <SegmentedControl
                          size="sm"
                          aria-label={t('leave.type')}
                          value={leave.type}
                          onChange={(type) => onType(leave.teacherId, type)}
                          options={LEAVE_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                        />
                      </span>
                      <span className="order-last w-full sm:hidden">
                        <Select
                          size="sm"
                          aria-label={t('leave.type')}
                          value={leave.type}
                          onChange={(type) => onType(leave.teacherId, type)}
                          options={LEAVE_TYPES.map((type) => ({ value: type, label: t(`types.${type}`) }))}
                        />
                      </span>
                      <IconButton icon="close" size="sm" label={t('leave.remove', { name })} onClick={() => onRemove(leave.teacherId)} />
                    </>
                  )}
                </div>
                {lessonRows(leave)}
              </li>
            );
          })}
        </ul>
      )}

      {gone.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 px-3 pb-3 md:px-4">
          {gone.map((r) => (
            <li key={`gone-${reliefKey(r)}`} className="flex flex-col gap-2 rounded-xl border border-line-soft bg-white px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 sm:flex-1">
                <strong className="block text-sm text-ink-muted line-through">{names.lesson(r)}</strong>
                <span className="text-[13px] text-ink-muted">{t('reliefs.for', { name: names.teacher(r.absentTeacherId) })}</span>
              </div>
              <div className="flex flex-col gap-1 sm:w-80 sm:shrink-0">
                <span className="text-sm text-ink-muted">{r.reliefTeacherId === null ? t('reliefs.uncovered') : names.teacher(r.reliefTeacherId)}</span>
                <span className="flex flex-wrap gap-1.5">
                  <Badge tone="warning">{t('reliefs.gone')}</Badge>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="border-t border-line-soft bg-white px-4 py-3 md:px-5">
          <Combobox
            items={addable}
            getKey={(x) => x.id}
            getLabel={(x) => names.teacher(x.id)}
            onChange={(x) => onAdd(x.id)}
            placeholder={`+ ${t('leave.add')}`}
            searchPlaceholder={t('leave.search')}
            className="w-full sm:w-72"
          />
        </div>
      )}

      {open !== null && openRelief && (
        <ReliefPicker
          lesson={names.lesson(openRelief)}
          absentName={names.teacher(openRelief.absentTeacherId)}
          candidates={candidatesOf(open)}
          current={openRelief.reliefTeacherId}
          names={names}
          onPick={(id) => onPick(open, id)}
          onClose={() => setOpen(null)}
        />
      )}
    </section>
  );
}
