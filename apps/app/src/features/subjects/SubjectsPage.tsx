// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { hasName, nameTaken, pickName, usageCount, type Lang, type Subject } from '@sathiya/core';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool, useYear } from '../../app/SchoolProvider';
import { useReadOnly } from '../../ui/AdminLayout';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ListRow, ListSection, ListTile } from '../../ui/GroupedList';
import { LoadingState } from '../../ui/LoadingState';
import { PageHeader } from '../../ui/PageHeader';
import { PHONE_QUERY, useMediaQuery } from '../../ui/PhoneNotice';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { ImportModal } from '../import/ImportModal';
import { DeleteSetupModal } from '../teachers/DeleteSetupModal';
import * as api from './api';
import { InlineInput } from './InlineInput';
import { SHORT_MAX } from './palette';
import { missingDefaults } from './standard';
import { SubjectModal } from './SubjectModal';

type Dialog = { kind: 'add' } | { kind: 'edit'; subject: Subject } | { kind: 'import' } | { kind: 'delete'; subject: Subject } | null;

export function SubjectsPage() {
  const { t, i18n } = useTranslation('subjects');
  const lang = i18n.language as Lang;
  const school = useSchool();
  const { entries } = useYear();
  const readOnly = useReadOnly();
  const isPhone = useMediaQuery(PHONE_QUERY);
  const toast = useToast();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [loading, setLoading] = useState(false);

  const subjects = [...school.subjects].sort((a, b) => pickName(a, lang).localeCompare(pickName(b, lang)));

  async function loadStandard() {
    setLoading(true);
    try {
      const toAdd = missingDefaults(school.subjects, await api.fetchDefaultSubjects());
      if (toAdd.length > 0) await api.addSubjects(school.school.id, toAdd);
      toast.show(t('page.loaded', { count: toAdd.length }), toAdd.length > 0 ? 'success' : 'info');
    } catch {
      toast.show(t('page.loadFailed'), 'error');
    } finally {
      setLoading(false);
    }
  }

  async function edit(s: Subject, patch: Partial<Omit<Subject, 'id'>>) {
    const others = school.subjects.filter((x) => x.id !== s.id);
    const otherNames = others.flatMap((x) => [x.nameEn, x.nameSi]);
    const clash = [
      patch.nameEn !== undefined && nameTaken(patch.nameEn, otherNames) ? patch.nameEn : null,
      patch.nameSi !== undefined && nameTaken(patch.nameSi, otherNames) ? patch.nameSi : null,
    ].find((n) => n !== null);
    if (!hasName({ ...s, ...patch })) {
      toast.show(t('common:names.missing'), 'error');
      return;
    }
    if (clash) {
      toast.show(t('modal.errors.nameTaken', { name: clash }), 'error');
      return;
    }
    try {
      const { id: _id, ...current } = s;
      await api.updateSubject(school.school.id, s.id, { ...current, ...patch });
    } catch {
      toast.show(t('page.saveFailed'), 'error');
    }
  }

  const add = (
    <Button variant="primary" onClick={() => setDialog({ kind: 'add' })}>
      {t('page.add')}
    </Button>
  );

  const other: Lang = lang === 'si' ? 'en' : 'si';
  const usage = new Map(subjects.map((s) => [s.id, usageCount('subject', s.id, school, entries)]));
  const phoneRow = (s: Subject) => {
    const name = pickName(s, lang);
    const missing = !(other === 'si' ? s.nameSi : s.nameEn)?.trim();
    const used = usage.get(s.id) ?? 0;
    return (
      <ListRow
        key={s.id}
        lead={<ListTile label={s.short} color={s.color} />}
        title={name}
        detail={
          missing ? (
            <Badge tone="warning">{t('page.showsOther', { name })}</Badge>
          ) : (
            pickName(s, other)
          )
        }
        onOpen={readOnly ? undefined : () => setDialog({ kind: 'edit', subject: s })}
        openLabel={t('phone.editFor', { name })}
        meta={used > 0 ? t('page.slots', { count: used }) : undefined}
        action={
          !readOnly && used === 0
            ? { label: t('page.delete'), ariaLabel: t('phone.deleteFor', { name }), tone: 'danger', onClick: () => setDialog({ kind: 'delete', subject: s }) }
            : undefined
        }
      />
    );
  };
  const unused = subjects.filter((s) => usage.get(s.id) === 0);
  const inUse = subjects.filter((s) => (usage.get(s.id) ?? 0) > 0);

  return (
    <div>
      <PageHeader
        title={t('page.title')}
        subtitle={t('page.intro')}
        phoneActions={readOnly ? null : add}
        actions={
          !readOnly && (
            <>
              <Button onClick={() => void loadStandard()} loading={loading}>
                {t('page.loadStandard')}
              </Button>
              <Button onClick={() => setDialog({ kind: 'import' })}>{t('import:open')}</Button>
              {add}
            </>
          )
        }
      />

      {isPhone && !readOnly && (
        <div className="mb-4 grid grid-cols-2 gap-2.5">
          <Button size="lg" className="h-auto min-h-11 py-1.5 leading-tight" onClick={() => void loadStandard()} loading={loading}>
            {t('page.loadStandard')}
          </Button>
          <Button size="lg" onClick={() => setDialog({ kind: 'import' })}>
            {t('import:open')}
          </Button>
        </div>
      )}

      {school.loading ? (
        <LoadingState />
      ) : subjects.length === 0 ? (
        <EmptyState icon="subjects" title={t('page.empty')} body={t('page.emptyBody')} action={readOnly ? undefined : add} />
      ) : isPhone ? (
        <>
          {unused.length > 0 && (
            <ListSection title={t('phone.unused')} count={unused.length} tone="warning">
              {unused.map(phoneRow)}
            </ListSection>
          )}
          {inUse.length > 0 && (
            <ListSection title={t('phone.used')} count={inUse.length}>
              {inUse.map(phoneRow)}
            </ListSection>
          )}
        </>
      ) : (
        <Table className="md:min-w-[720px]">
          <THead>
            <tr>
              <Th className="w-16">{t('page.cols.colour')}</Th>
              <Th>{t('page.cols.english')}</Th>
              <Th>{t('page.cols.sinhala')}</Th>
              <Th className="w-32">{t('page.cols.short')}</Th>
              <Th>{t('page.cols.usedIn')}</Th>
              {!readOnly && <Th className="w-24">{t('page.cols.actions')}</Th>}
            </tr>
          </THead>
          <TBody>
            {subjects.map((s) => (
              <Tr key={s.id}>
                <Td>
                  <span
                    className="block h-[22px] w-[22px] rounded-md border border-black/10"
                    style={{ background: s.color }}
                    role="img"
                    aria-label={`${pickName(s, lang)} ${s.color}`}
                  />
                </Td>
                <Td>
                  <InlineInput
                    label={t('page.fields.english', { name: pickName(s, lang) })}
                    value={s.nameEn}
                    placeholder={s.nameEn.trim() ? undefined : t('page.showsOther', { name: pickName(s, 'si') })}
                    readOnly={readOnly}
                    className="font-semibold"
                    onCommit={(v) => void edit(s, { nameEn: v })}
                  />
                </Td>
                <Td>
                  <InlineInput
                    label={t('page.fields.sinhala', { name: pickName(s, lang) })}
                    value={s.nameSi ?? ''}
                    placeholder={s.nameSi?.trim() ? undefined : t('page.showsOther', { name: pickName(s, 'en') })}
                    readOnly={readOnly}
                    onCommit={(v) => void edit(s, { nameSi: v })}
                  />
                </Td>
                <Td>
                  <InlineInput
                    label={t('page.fields.short', { name: pickName(s, lang) })}
                    value={s.short}
                    required
                    maxLength={SHORT_MAX}
                    readOnly={readOnly}
                    onCommit={(v) => void edit(s, { short: v })}
                  />
                </Td>
                <Td className="text-[13px] text-ink-soft">{t('page.slots', { count: usage.get(s.id) ?? 0 })}</Td>
                {!readOnly && (
                  <Td>
                    <Button size="sm" variant="ghost" onClick={() => setDialog({ kind: 'delete', subject: s })}>
                      {t('page.delete')}
                    </Button>
                  </Td>
                )}
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
      <p className="mt-3 text-[13px] text-ink-soft">{t('page.footnote')}</p>

      {dialog?.kind === 'add' && <SubjectModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <SubjectModal subject={dialog.subject} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'import' && <ImportModal onClose={() => setDialog(null)} />}
      {dialog?.kind === 'delete' && (
        <DeleteSetupModal
          schoolId={school.school.id}
          kind="subject"
          id={dialog.subject.id}
          name={pickName(dialog.subject, lang)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
