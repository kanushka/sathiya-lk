// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { ctx } from '@sathiya/core/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithSchool } from '../../test/renderWithSchool';
import { AnnouncementBanner } from './AnnouncementBanner';
import { AnnouncementsPage } from './AnnouncementsPage';
import { DefaultSubjectsPage } from './DefaultSubjectsPage';
import { termsCollectionPath, TermsExistsError, type PlatformConfig, type PlatformWriter } from './platform';
import { TermsPage } from './TermsPage';

const opts = { ctx, claims: { super: true } };

function fakeWriter(): PlatformWriter {
  return {
    saveDefaultSubjects: vi.fn().mockResolvedValue(undefined),
    saveAnnouncement: vi.fn().mockResolvedValue(undefined),
    publishTerms: vi.fn().mockResolvedValue(undefined),
  };
}

const config = (announcement?: PlatformConfig['announcement']): PlatformConfig => ({ currentTermsVersion: '2026-01', announcement });
const ann = (over = {}) => ({ textEn: 'Maintenance on Friday', textSi: 'සිකුරාදා නඩත්තුව', active: true, updatedAt: 1, ...over });

beforeEach(() => sessionStorage.clear());

describe('AnnouncementBanner', () => {
  it('shows the active English text', () => {
    renderWithSchool(<AnnouncementBanner config={config(ann())} />, opts);
    expect(screen.getByText('Maintenance on Friday')).toBeInTheDocument();
  });

  it('shows Sinhala text for si', () => {
    renderWithSchool(<AnnouncementBanner config={config(ann())} />, { ...opts, lang: 'si' });
    expect(screen.getByText('සිකුරාදා නඩත්තුව')).toBeInTheDocument();
  });

  it('falls back to English when textSi is empty', () => {
    renderWithSchool(<AnnouncementBanner config={config(ann({ textSi: '' }))} />, { ...opts, lang: 'si' });
    expect(screen.getByText('Maintenance on Friday')).toBeInTheDocument();
  });

  it.each([
    ['inactive', config(ann({ active: false }))],
    ['empty text', config(ann({ textEn: '  ' }))],
    ['absent', config()],
  ])('is hidden when %s', (_name, cfg) => {
    const { container } = renderWithSchool(<AnnouncementBanner config={cfg} />, opts);
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('can be dismissed for the session', async () => {
    renderWithSchool(<AnnouncementBanner config={config(ann())} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByText('Maintenance on Friday')).toBeNull();
  });
});

describe('AnnouncementsPage', () => {
  it('saves the announcement shape', async () => {
    const writer = fakeWriter();
    vi.spyOn(Date, 'now').mockReturnValue(1700);
    renderWithSchool(<AnnouncementsPage config={{ loading: false, data: config() }} writer={writer} />, opts);
    await userEvent.type(screen.getByLabelText('Message (English)'), 'Hello schools');
    await userEvent.type(screen.getByLabelText('Message (Sinhala)'), 'ආයුබෝවන්');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Show banner' }));
    expect(screen.getByTestId('banner-preview')).toHaveTextContent('Hello schools');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(writer.saveAnnouncement).toHaveBeenCalledWith({ textEn: 'Hello schools', textSi: 'ආයුබෝවන්', active: true, updatedAt: 1700 }),
    );
    expect(await screen.findByText('Announcement saved')).toBeInTheDocument();
    vi.restoreAllMocks();
  });

  it('requires English text', async () => {
    const writer = fakeWriter();
    renderWithSchool(<AnnouncementsPage config={{ loading: false, data: config() }} writer={writer} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter the English message')).toBeInTheDocument();
    expect(writer.saveAnnouncement).not.toHaveBeenCalled();
  });
});

describe('AnnouncementsPage load state', () => {
  it('shows a load error and no form when the config fails to load', () => {
    const writer = fakeWriter();
    renderWithSchool(<AnnouncementsPage config={{ loading: false, error: new Error('denied') }} writer={writer} />, opts);
    expect(screen.getByText('Could not load the announcement.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(screen.queryByLabelText('Message (English)')).toBeNull();
  });

  it('does not leak the raw error message on save failure', async () => {
    const writer = fakeWriter();
    vi.mocked(writer.saveAnnouncement).mockRejectedValue(new Error('PERMISSION_DENIED raw'));
    renderWithSchool(<AnnouncementsPage config={{ loading: false, data: config() }} writer={writer} />, opts);
    await userEvent.type(screen.getByLabelText('Message (English)'), 'Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Could not save: Something went wrong. Try again.')).toBeInTheDocument();
  });
});

describe('TermsPage config error', () => {
  it('hints when the current version cannot be determined', () => {
    renderWithSchool(<TermsPage versions={{ data: [], loading: false }} config={{ loading: false, error: new Error('x') }} writer={fakeWriter()} />, opts);
    expect(screen.getByText('Could not load the current version, so none is marked.')).toBeInTheDocument();
  });
});

describe('platform paths', () => {
  it('termsCollectionPath has no trailing slash', () => {
    expect(termsCollectionPath.endsWith('/')).toBe(false);
  });
});

describe('DefaultSubjectsPage', () => {
  const existing = { id: 'defaultSubjects', subjects: [{ nameEn: 'Mathematics', nameSi: 'ගණිතය', short: 'MAT', color: '#2563EB' }], updatedAt: 1 };

  it('adds a subject and saves the whole list', async () => {
    const writer = fakeWriter();
    vi.spyOn(Date, 'now').mockReturnValue(1700);
    renderWithSchool(<DefaultSubjectsPage doc={{ loading: false, data: existing }} writer={writer} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'Add subject' }));
    const dlg = within(screen.getByRole('dialog'));
    await userEvent.type(dlg.getByLabelText('Name (English)'), 'Science');
    await userEvent.type(dlg.getByLabelText('Name (Sinhala)'), 'විද්‍යාව');
    await userEvent.type(dlg.getByLabelText('Short name'), 'SCI');
    await userEvent.click(dlg.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(writer.saveDefaultSubjects).toHaveBeenCalledWith({
        subjects: [existing.subjects[0], { nameEn: 'Science', nameSi: 'විද්‍යාව', short: 'SCI', color: '#0E6B6A' }],
        updatedAt: 1700,
      }),
    );
    vi.restoreAllMocks();
  });

  it.each([
    ['loading', { loading: true }],
    ['errored', { loading: false, error: new Error('denied') }],
  ])('blocks add, edit and delete while the list is %s', (_n, doc) => {
    const writer = fakeWriter();
    renderWithSchool(<DefaultSubjectsPage doc={doc} writer={writer} />, opts);
    expect(screen.getByRole('button', { name: 'Add subject' })).toBeDisabled();
    expect(writer.saveDefaultSubjects).not.toHaveBeenCalled();
  });

  it('enables edit and delete once loaded', () => {
    renderWithSchool(<DefaultSubjectsPage doc={{ loading: false, data: existing }} writer={fakeWriter()} />, opts);
    expect(screen.getByRole('button', { name: 'Edit Mathematics' })).toBeEnabled();
  });

  it('validates required fields, short length and hex colour', async () => {
    const writer = fakeWriter();
    renderWithSchool(<DefaultSubjectsPage doc={{ loading: false, data: existing }} writer={writer} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'Add subject' }));
    const dlg = within(screen.getByRole('dialog'));
    await userEvent.type(dlg.getByLabelText('Short name'), 'TOOLONG');
    await userEvent.click(dlg.getByRole('button', { name: 'Save' }));
    expect(dlg.getByText('Enter the English name')).toBeInTheDocument();
    expect(dlg.getByText('Use 4 characters or fewer')).toBeInTheDocument();
    expect(writer.saveDefaultSubjects).not.toHaveBeenCalled();
  });

  it('edits and deletes after confirm', async () => {
    const writer = fakeWriter();
    renderWithSchool(<DefaultSubjectsPage doc={{ loading: false, data: existing }} writer={writer} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'Edit Mathematics' }));
    const dlg = within(screen.getByRole('dialog'));
    await userEvent.clear(dlg.getByLabelText('Short name'));
    await userEvent.type(dlg.getByLabelText('Short name'), 'MA');
    await userEvent.click(dlg.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(writer.saveDefaultSubjects).toHaveBeenCalledTimes(1));
    expect(vi.mocked(writer.saveDefaultSubjects).mock.calls[0]?.[0].subjects[0]?.short).toBe('MA');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Mathematics' }));
    expect(writer.saveDefaultSubjects).toHaveBeenCalledTimes(1);
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete subject' }));
    await waitFor(() => expect(writer.saveDefaultSubjects).toHaveBeenCalledTimes(2));
    expect(vi.mocked(writer.saveDefaultSubjects).mock.calls[1]?.[0].subjects).toEqual([]);
  });
});

describe('TermsPage', () => {
  const versions = [
    { id: '2026-01', version: '2026-01', termsMd: 'old', privacyMd: 'old', publishedAt: 100 },
    { id: '2026-09', version: '2026-09', termsMd: 'newer', privacyMd: 'newer', publishedAt: 200 },
  ];
  const props = (writer: PlatformWriter) => ({
    versions: { data: versions, loading: false },
    config: { loading: false, data: config() },
    writer,
  });

  it('lists newest first and marks current', () => {
    renderWithSchool(<TermsPage {...props(fakeWriter())} />, opts);
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('2026-09');
    expect(rows[1]).toHaveTextContent('2026-01');
    expect(rows[1]).toHaveTextContent('Current');
    expect(rows[0]).not.toHaveTextContent('Current');
  });

  it('publishes a new version via the writer and warns about re-accept', async () => {
    const writer = fakeWriter();
    vi.spyOn(Date, 'now').mockReturnValue(1700);
    renderWithSchool(<TermsPage {...props(writer)} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'New version' }));
    const dlg = within(screen.getByRole('dialog'));
    expect(dlg.getByText(/asked to accept/)).toBeInTheDocument();
    await userEvent.type(dlg.getByLabelText('Version id'), '2027-01');
    await userEvent.type(dlg.getByLabelText('Terms (Markdown)'), 'T');
    await userEvent.type(dlg.getByLabelText('Privacy policy (Markdown)'), 'P');
    await userEvent.click(dlg.getByRole('button', { name: 'Publish' }));
    await waitFor(() =>
      expect(writer.publishTerms).toHaveBeenCalledWith({ version: '2027-01', termsMd: 'T', privacyMd: 'P', publishedAt: 1700 }),
    );
    vi.restoreAllMocks();
  });

  it('rejects a duplicate version id', async () => {
    const writer = fakeWriter();
    renderWithSchool(<TermsPage {...props(writer)} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'New version' }));
    const dlg = within(screen.getByRole('dialog'));
    await userEvent.type(dlg.getByLabelText('Version id'), '2026-09');
    await userEvent.type(dlg.getByLabelText('Terms (Markdown)'), 'T');
    await userEvent.type(dlg.getByLabelText('Privacy policy (Markdown)'), 'P');
    await userEvent.click(dlg.getByRole('button', { name: 'Publish' }));
    expect(await dlg.findByText('That version already exists')).toBeInTheDocument();
    expect(writer.publishTerms).not.toHaveBeenCalled();
  });

  it('surfaces the writer exists-error as the duplicate error', async () => {
    const writer = fakeWriter();
    vi.mocked(writer.publishTerms).mockRejectedValue(new TermsExistsError('2027-01'));
    renderWithSchool(<TermsPage {...props(writer)} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'New version' }));
    const dlg = within(screen.getByRole('dialog'));
    await userEvent.type(dlg.getByLabelText('Version id'), '2027-01');
    await userEvent.type(dlg.getByLabelText('Terms (Markdown)'), 'T');
    await userEvent.type(dlg.getByLabelText('Privacy policy (Markdown)'), 'P');
    await userEvent.click(dlg.getByRole('button', { name: 'Publish' }));
    expect(await dlg.findByText('That version already exists')).toBeInTheDocument();
  });

  it.each([
    ['loading', { data: [], loading: true }],
    ['errored', { data: [], loading: false, error: new Error('denied') }],
  ])('disables Publish while versions are %s', async (_n, versions) => {
    renderWithSchool(<TermsPage versions={versions} config={{ loading: false, data: config() }} writer={fakeWriter()} />, opts);
    await userEvent.click(screen.getByRole('button', { name: 'New version' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Publish' })).toBeDisabled();
  });
});
