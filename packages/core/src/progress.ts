import { DAYS } from './lookup';
import { entryPlanKey, planKey } from './plan';
import { periodsFor } from './time';
import type { Entry, PeriodTemplate, PlanItem } from './types';

export interface ProgressRow { key: string; item: PlanItem; placed: number; needed: number }

export function classProgress(classId: string, entries: Entry[], plan: PlanItem[]): ProgressRow[] {
  const placed = new Map<string, number>();
  for (const e of entries) {
    if (!e.classIds.includes(classId)) continue;
    const key = entryPlanKey(e, plan);
    if (key !== null) placed.set(key, (placed.get(key) ?? 0) + 1);
  }
  return plan.map((item) => {
    const key = planKey(item);
    return { key, item, placed: placed.get(key) ?? 0, needed: item.perWeek };
  });
}

export function weekCapacity(t: PeriodTemplate): number {
  return DAYS.reduce<number>((n, day) => n + periodsFor(t, day).length, 0);
}
