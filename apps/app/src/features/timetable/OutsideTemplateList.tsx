// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { pickName, teacherDisplayName, type Entry } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useSchool } from '../../app/SchoolProvider';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';
import { classNames } from './labels';
import { OUTSIDE_TEMPLATE_ID } from './paths';

export interface OutsideTemplateListProps {
  entries: Entry[];
  onDelete(id: string): Promise<boolean>;
  readOnly?: boolean;
}

export function OutsideTemplateList({ entries, onDelete, readOnly = false }: OutsideTemplateListProps) {
  const { t } = useTranslation('timetable');
  const { t: tc } = useTranslation('common');
  const { lang } = useLang();
  const ctx = useSchool();
  const [confirming, setConfirming] = useState<Entry | null>(null);
  const [busy, setBusy] = useState(false);

  if (entries.length === 0 && !confirming) return null;

  const describe = (e: Entry) => {
    const subjects = [...new Set(e.lessons.map((l) => l.subjectId))]
      .map((id) => {
        const s = ctx.subjects.find((x) => x.id === id);
        return s ? pickName(s, lang) : id;
      })
      .join(' / ');
    const teachers = e.teacherIds
      .map((id) => ctx.teachers.find((x) => x.id === id))
      .flatMap((x) => (x ? [teacherDisplayName(x, lang)] : []))
      .join(', ');
    return {
      slot: t('outsideTemplate.slot', { day: tc(`days.short.${e.day}`), period: e.period }),
      classes: classNames(ctx, e.classIds),
      subjects,
      teachers: teachers || t('outsideTemplate.noTeacher'),
    };
  };

  async function confirmDelete() {
    if (!confirming) return;
    setBusy(true);
    const ok = await onDelete(confirming.id);
    setBusy(false);
    if (ok) setConfirming(null);
  }

  const target = confirming && describe(confirming);

  return (
    <>
      {entries.length > 0 && (
        <section
          id={OUTSIDE_TEMPLATE_ID}
          aria-labelledby={`${OUTSIDE_TEMPLATE_ID}-title`}
          className="mb-4 scroll-mt-4 rounded-[14px] border border-danger-line bg-danger-soft/40 p-4"
        >
          <h2 id={`${OUTSIDE_TEMPLATE_ID}-title`} className="m-0 text-[15px] font-bold text-ink">
            {t('outsideTemplate.title')}
          </h2>
          <p className="mb-2 mt-0.5 text-xs text-ink-muted">{t('outsideTemplate.hint')}</p>
          <ul className="m-0 list-none p-0">
            {entries.map((e) => {
              const d = describe(e);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm text-ink-soft first:border-t-0">
                  <span>{t('outsideTemplate.item', d)}</span>
                  {!readOnly && (
                    <Button
                      size="sm"
                      variant="danger"
                      aria-label={t('outsideTemplate.delete', { slot: d.slot, subjects: d.subjects })}
                      onClick={() => setConfirming(e)}
                    >
                      {tc('buttons.delete')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {confirming && target && (
        <Modal
          open
          width={460}
          title={t('outsideTemplate.confirmTitle')}
          onClose={() => setConfirming(null)}
          busy={busy}
          footer={
            <>
              <Button onClick={() => setConfirming(null)} disabled={busy}>
                {tc('buttons.cancel')}
              </Button>
              <Button variant="dangerSolid" onClick={() => void confirmDelete()} loading={busy} loadingLabel={tc('busy.deleting')}>
                {tc('buttons.delete')}
              </Button>
            </>
          }
        >
          <p className="text-sm text-ink-soft">{t('outsideTemplate.confirmBody', target)}</p>
        </Modal>
      )}
    </>
  );
}
