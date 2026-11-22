// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import {
  pickName,
  readSheets,
  teacherDisplayName,
  validateImport,
  type ImportError,
  type ImportKind,
  type ImportPlan,
  type ImportRow,
  type ImportSetupRes,
  type Lang,
  type ParsedSheets,
} from '@sathiya/core';
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchool } from '../../app/SchoolProvider';
import { ApiError, isSchoolDisabled, toApiError } from '../../lib/callable';
import { Button, buttonClass } from '../../ui/Button';
import { cx } from '../../ui/cx';
import { FormError } from '../../ui/FormError';
import { Modal } from '../../ui/Modal';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { usePrintLabels } from '../teachers/LoginSlip';
import { printSlips } from '../teachers/printSlips';
import { useSessionPasswords } from '../teachers/sessionPasswords';
import { teacherLoginUrl } from '../teachers/slip';
import { importSetup } from './api';
import { ImportFileError, readImportFile } from './readFile';
import { downloadBlob, templateCsv, templateSheetNames, templateXlsx } from './template';

type View =
  | { kind: 'start' }
  | { kind: 'preview'; fileName: string; parsed: ParsedSheets; plan: ImportPlan; errors: ImportError[]; knownSubjectIds: string[] }
  | { kind: 'done'; res: ImportSetupRes };

function isImportErrors(details: unknown): details is { errors: ImportError[] } {
  return Array.isArray((details as { errors?: unknown } | null | undefined)?.errors);
}

// The server refuses with an API code (or permission-denied) only before writing anything. A timeout,
// network drop or internal error maps to a bare 'invalid' and may come after some rows were saved.
function wasRejected(err: unknown): boolean {
  const e = toApiError(err);
  return e.code !== 'invalid' || typeof (e.details as { code?: unknown } | null | undefined)?.code === 'string';
}

const MAX_SHOWN_ERRORS = 100;

function ErrorTable({ errors }: { errors: ImportError[] }) {
  const { t } = useTranslation('import');
  const message = (e: ImportError) =>
    e.code === 'missingHeader' && typeof e.params?.column === 'string'
      ? t('errors.missingHeader', { name: t(`columns.${e.params.column}`) })
      : t(`errors.${e.code}`, { ...e.params });
  const hidden = errors.length - MAX_SHOWN_ERRORS;
  return (
    <div className="flex flex-col gap-2">
      <FormError>{t('errorsTitle', { count: errors.length })}</FormError>
      <div className="max-h-[320px] overflow-auto">
        <Table>
          <THead>
            <tr>
              <Th>{t('cols.sheet')}</Th>
              <Th>{t('cols.row')}</Th>
              <Th>{t('cols.column')}</Th>
              <Th>{t('cols.problem')}</Th>
            </tr>
          </THead>
          <TBody>
            {errors.slice(0, MAX_SHOWN_ERRORS).map((e, i) => (
              <Tr key={i}>
                <Td>{t(`sheets.${e.sheet}`)}</Td>
                <Td className="tabular-nums">{e.row ?? '—'}</Td>
                <Td>{e.column ? t(`columns.${e.column}`) : '—'}</Td>
                <Td>{message(e)}</Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>
      {hidden > 0 && <p className="m-0 text-sm text-ink-soft">{t('errorsMore', { count: hidden })}</p>}
    </div>
  );
}

export function ImportModal({ onClose }: { onClose: () => void }) {
  const { t, i18n } = useTranslation('import');
  const lang = i18n.language as Lang;
  const { school, subjects, teachers } = useSchool();
  const toast = useToast();
  const printLabels = usePrintLabels();
  const { set: setSessionPassword } = useSessionPasswords();
  const [view, setView] = useState<View>({ kind: 'start' });
  const [reading, setReading] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const readSeq = useRef(0);

  const counts = (s: number, tc: number) => ({
    subjects: t('subjectCount', { count: s }),
    teachers: t('teacherCount', { count: tc }),
  });

  async function download(kind: 'xlsx' | ImportKind) {
    try {
      if (kind === 'xlsx') {
        const fixed = (l: Lang) => i18n.getFixedT(l, 'import');
        const both = (key: string) => `${fixed('en')(key)} / ${fixed('si')(key)}`;
        const blob = await templateXlsx({
          staffPrefix: school.staffPrefix,
          grades: [...school.grades].sort((a, b) => a - b),
          instructions: {
            en: fixed('en')('instructions', { returnObjects: true }) as string[],
            si: fixed('si')('instructions', { returnObjects: true }) as string[],
          },
          labels: { titles: both('templateLabels.titles'), grades: both('templateLabels.grades'), staffId: both('templateLabels.staffId') },
          sheetNames: templateSheetNames(i18n),
        });
        downloadBlob(blob, 'sathiya-import-template.xlsx');
      } else {
        downloadBlob(new Blob([templateCsv(kind)], { type: 'text/csv;charset=utf-8' }), `sathiya-${kind}.csv`);
      }
    } catch {
      toast.show(t('downloadFailed'), 'error');
    }
  }

  async function chooseFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const seq = ++readSeq.current;
    setReading(true);
    setFileError(null);
    setFailure(null);
    try {
      const parsed = readSheets(await readImportFile(file));
      const plan = validateImport(parsed, {
        staffPrefix: school.staffPrefix,
        schoolGrades: school.grades,
        subjects,
        staffIds: teachers.map((x) => x.staffId),
      });
      if (seq !== readSeq.current) return;
      setView({
        kind: 'preview',
        fileName: file.name,
        parsed,
        plan,
        errors: [...parsed.errors, ...plan.errors],
        knownSubjectIds: subjects.map((s) => s.id),
      });
    } catch (err) {
      if (seq !== readSeq.current) return;
      setView({ kind: 'start' });
      setFileError(t(`fileErrors.${err instanceof ImportFileError ? err.reason : 'unreadable'}`));
    } finally {
      if (seq === readSeq.current) setReading(false);
    }
  }

  async function runImport() {
    if (view.kind !== 'preview') return;
    setImporting(true);
    setFailure(null);
    try {
      const strip = <C extends string>(rows: ImportRow<C>[]) => rows.map(({ row, cells }) => ({ row, cells }));
      const res = await importSetup({
        schoolId: school.id,
        knownSubjectIds: view.knownSubjectIds,
        subjects: strip(view.parsed.subjects),
        teachers: strip(view.parsed.teachers),
      });
      for (const x of res.teachers) setSessionPassword(x.teacherId, x.password);
      setView({ kind: 'done', res });
    } catch (err) {
      if (err instanceof ApiError && err.code === 'invalid' && isImportErrors(err.details)) {
        const errors = err.details.errors;
        setView((v) => (v.kind === 'preview' ? { ...v, errors } : v));
      } else if (wasRejected(err)) {
        setFailure(t(isSchoolDisabled(err) ? 'shell:suspended.writeBlocked' : 'failed'));
      } else {
        setView({ kind: 'start' });
        setFailure(t('mayHaveImported'));
      }
    } finally {
      setImporting(false);
    }
  }

  async function printNew(res: ImportSetupRes) {
    const url = teacherLoginUrl(window.location.origin, school.id);
    const slips = res.teachers.map((x) => ({
      schoolName: pickName(school, lang),
      staffId: x.staffId,
      name: teacherDisplayName(x, lang),
      password: x.password,
      url,
    }));
    if (!(await printSlips(slips, printLabels))) toast.show(t('teachers:page.printBlocked'), 'error');
  }

  if (view.kind === 'done') {
    const { res } = view;
    return (
      <Modal
        key="done"
        open
        width={520}
        title={t('doneTitle')}
        onClose={onClose}
        footer={
          <>
            <Button onClick={() => void printNew(res)} disabled={res.teachers.length === 0}>
              {t('printSlips')}
            </Button>
            <Button variant="primary" onClick={onClose}>
              {t('done')}
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm text-ink">{t('doneBody', counts(res.subjectIds.length, res.teachers.length))}</p>
        {res.teachers.length > 0 && <p className="m-0 mt-2 text-sm text-ink-soft">{t('slipsHint')}</p>}
        {res.notCreated.length > 0 && <FormError className="mt-3">{t('notCreated', { list: res.notCreated.join(', ') })}</FormError>}
      </Modal>
    );
  }

  const preview = view.kind === 'preview' ? view : null;
  const total = preview ? preview.plan.subjects.length + preview.plan.teachers.length : 0;
  const canImport = !!preview && preview.errors.length === 0 && total > 0 && !reading;

  return (
    <Modal
      key="main"
      open
      width={760}
      title={t('title')}
      subtitle={t('subtitle')}
      onClose={onClose}
      busy={importing}
      footer={
        <>
          {failure && <FormError className="mr-auto">{failure}</FormError>}
          <Button onClick={onClose} disabled={importing}>
            {t('cancel')}
          </Button>
          <Button variant="primary" onClick={() => void runImport()} disabled={!canImport} loading={importing} loadingLabel={t('importing')}>
            {t('import')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <section className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void download('xlsx')}>
              {t('downloadXlsx')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void download('subjects')}>
              {t('downloadCsvSubjects')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void download('teachers')}>
              {t('downloadCsvTeachers')}
            </Button>
          </div>
          <p className="m-0 text-xs text-ink-muted">{t('templateHint')}</p>
        </section>

        <section className="flex flex-col gap-2 rounded-lg border border-dashed border-line-strong bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className={cx(buttonClass({ variant: 'primary' }), 'cursor-pointer has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2', importing && 'pointer-events-none opacity-[.45]')}>
              {t('chooseFile')}
              <input type="file" accept=".xlsx,.csv" className="sr-only" disabled={importing} onChange={(e) => void chooseFile(e)} />
            </label>
            {reading && <span className="text-sm text-ink-soft" role="status">{t('reading')}</span>}
          </div>
          <p className="m-0 text-xs text-ink-muted">{preview ? t('file', { name: preview.fileName }) : t('help')}</p>
          <FormError>{fileError}</FormError>
        </section>

        {preview && !reading &&
          (preview.errors.length > 0 ? (
            <ErrorTable errors={preview.errors} />
          ) : total === 0 ? (
            <p className="m-0 text-sm text-ink-soft">{t('nothing')}</p>
          ) : (
            <section className="flex flex-col gap-2">
              <p className="m-0 text-sm font-semibold text-ink">
                {t('summary', counts(preview.plan.subjects.length, preview.plan.teachers.length))}
              </p>
              {preview.plan.teachers.length > 0 && (
                <>
                  <h3 className="m-0 text-[13px] font-bold uppercase tracking-[.04em] text-ink-muted">{t('previewTitle')}</h3>
                  <ul className="m-0 max-h-[240px] list-none overflow-auto rounded-lg border border-line p-0 text-sm">
                    {preview.plan.teachers.map(({ row, teacher }) => (
                      <li key={row} className="flex gap-3 border-b border-line px-3 py-1.5 last:border-b-0">
                        <span className="w-20 shrink-0 font-mono text-[13px]">{teacher.staffId}</span>
                        <span>{teacherDisplayName(teacher, lang)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          ))}
      </div>
    </Modal>
  );
}
