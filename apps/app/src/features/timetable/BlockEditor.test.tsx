import type { Entry, PlanItem, SchoolContext } from '@sathiya/core';
import { C, ctx, entries6B, entry, S, T } from '@sathiya/core/fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { BlockEditor, type BlockEditorProps } from './BlockEditor';
import { TimetableApiContext, type TimetableApi } from './useTimetable';

const ro = vi.hoisted(() => ({ value: false }));
vi.mock('../../ui/AdminLayout', () => ({ useReadOnly: () => ro.value }));

const religion = ctx.grades.find((g) => g.number === 6)!.plan.find((p) => p.kind === 'group' && p.key === 'religion') as Extract<PlanItem, { kind: 'group' }>;

function setup(props: Partial<BlockEditorProps> = {}, opts: { ctx?: SchoolContext; entries?: Entry[] } = {}) {
  const api: TimetableApi = {
    saveEntry: vi.fn().mockResolvedValue({ entryId: 'new' }),
    deleteEntry: vi.fn().mockResolvedValue({ ok: true }),
  };
  const onClose = vi.fn();
  renderWithSchool(
    <TimetableApiContext.Provider value={api}>
      <BlockEditor open onClose={onClose} baseClassId={C.c6b} day={2} period={4} mode={{ kind: 'group', item: religion }} {...props} />
    </TimetableApiContext.Provider>,
    { ctx: opts.ctx ?? ctx, entries: opts.entries ?? entries6B },
  );
  return { api, onClose };
}

const pick = (name: RegExp, value: string) => fireEvent.change(screen.getByLabelText(name), { target: { value } });

beforeEach(() => {
  ro.value = false;
});

describe('BlockEditor', () => {
  it('lists only joinable classes of the same grade and template', () => {
    setup();
    expect(screen.getByRole('button', { name: '6A' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '6C' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '1A' })).not.toBeInTheDocument();
  });

  it('flags a busy teacher and does not allow selecting them', () => {
    const busy = [...entries6B, entry('x', 2, 4, [C.c6a], [[S.sinhala, T.ananda]])];
    setup({ baseClassId: C.c6b }, { entries: busy });
    const opt = within(screen.getByLabelText(/Buddhism/)).getByRole('option', { name: /Ananda/ });
    expect(opt).toBeDisabled();
    expect(opt).toHaveTextContent('Busy · 6A Sinhala');
  });

  it('saves a group draft for two classes with a teacher per option', async () => {
    const { api, onClose } = setup();
    await userEvent.click(screen.getByRole('button', { name: '6A' }));
    pick(/Buddhism/, T.ananda);
    pick(/Catholicism/, T.mSilva);
    pick(/Islam/, T.rizan);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.saveEntry).toHaveBeenCalledWith({
      schoolId: ctx.school.id,
      yearId: 'y-2026',
      entry: {
        day: 2,
        period: 4,
        classIds: [C.c6b, C.c6a],
        groupKey: 'religion',
        lessons: [
          { subjectId: S.buddhism, teacherId: T.ananda },
          { subjectId: S.catholicism, teacherId: T.mSilva },
          { subjectId: S.islam, teacherId: T.rizan },
        ],
      },
    });
  });

  it('saves with a null teacher and shows the no-teacher warning', async () => {
    const { api } = setup();
    expect(screen.getAllByText('No teacher yet')).toHaveLength(3);
    pick(/Buddhism/, T.ananda);
    expect(screen.getAllByText('No teacher yet')).toHaveLength(2);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
    const draft = vi.mocked(api.saveEntry).mock.calls[0]![0].entry;
    expect(draft.lessons).toEqual([
      { subjectId: S.buddhism, teacherId: T.ananda },
      { subjectId: S.catholicism, teacherId: null },
      { subjectId: S.islam, teacherId: null },
    ]);
  });

  it('builds a one-lesson multi-class combined draft without groupKey', async () => {
    const { api } = setup({ mode: { kind: 'combined', subjectId: S.maths } });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: '6A' }));
    pick(/^Mathematics$/, T.bandara);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
    const draft = vi.mocked(api.saveEntry).mock.calls[0]![0].entry;
    expect(draft).toEqual({ day: 2, period: 4, classIds: [C.c6b, C.c6a], lessons: [{ subjectId: S.maths, teacherId: T.bandara }] });
    expect(draft).not.toHaveProperty('groupKey');
  });

  it('honours per-class plan: Buddhism a group option in 6B, a subject in 6A override', () => {
    const plan: PlanItem[] = [{ kind: 'subject', subjectId: S.buddhism, perWeek: 3 }];
    const noGroup = { ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6a ? { ...c, planOverride: plan } : c)) };
    setup({}, { ctx: noGroup });
    expect(screen.queryByRole('button', { name: '6A' })).not.toBeInTheDocument();
  });

  it('combined mode offers only classes with that subject as a subject item', () => {
    const plan: PlanItem[] = [{ kind: 'subject', subjectId: S.buddhism, perWeek: 3 }];
    const c2 = { ...ctx, classes: ctx.classes.map((c) => (c.id === C.c6a ? { ...c, planOverride: plan } : c)) };
    setup({ baseClassId: C.c6b, mode: { kind: 'combined', subjectId: S.buddhism } }, { ctx: c2 });
    expect(screen.getByRole('button', { name: '6A' })).toBeInTheDocument();
  });

  it('removes an existing block', async () => {
    const existing = entries6B.find((e) => e.id === 'e-religion-2-2')!;
    const { api, onClose } = setup({ period: 2, entry: existing });
    await userEvent.click(screen.getByRole('button', { name: 'Remove block' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.deleteEntry).toHaveBeenCalledWith({ schoolId: ctx.school.id, yearId: 'y-2026', entryId: 'e-religion-2-2' });
  });

  it('hides Save and Remove when read-only', () => {
    ro.value = true;
    const existing = entries6B.find((e) => e.id === 'e-religion-2-2')!;
    setup({ period: 2, entry: existing });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove block' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Buddhism/)).toBeDisabled();
  });

  it('blocks save when one teacher is chosen for two options', async () => {
    setup();
    pick(/Buddhism/, T.ananda);
    pick(/Islam/, T.ananda);
    expect(screen.getAllByText('Already chosen for another option').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('flags a limit-reached teacher but still allows saving', async () => {
    const full = Array.from({ length: 5 }, (_, i) => entry(`f${i}`, 2, i + 5, [C.c6a], [[S.buddhism, T.ananda]]));
    const { api } = setup({}, { entries: [...entries6B, ...full] });
    expect(within(screen.getByLabelText(/Buddhism/)).getByRole('option', { name: /Ananda/ })).toHaveTextContent('Limit reached · 6/6 today');
    pick(/Buddhism/, T.ananda);
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.saveEntry).toHaveBeenCalled());
  });

  it('renders nothing actionable when the slot is not in the class template', () => {
    setup({ baseClassId: C.c6c, day: 4, period: 8 });
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });
});
