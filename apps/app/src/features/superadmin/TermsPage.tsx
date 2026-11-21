import { paths } from '@sathiya/core';
import { orderBy } from 'firebase/firestore';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../../app/LangProvider';
import { useCollection, useDoc, type CollectionState, type DocState } from '../../lib/firestore';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Field, inputClass } from '../../ui/Field';
import { LoadingState } from '../../ui/LoadingState';
import { Modal } from '../../ui/Modal';
import { Table, TBody, Td, Th, THead, Tr } from '../../ui/Table';
import { useToast } from '../../ui/Toast';
import { formatDate } from './format';
import { firestorePlatformWriter, termsCollectionPath, TermsExistsError, type PlatformConfig, type PlatformWriter, type TermsVersion } from './platform';

export interface TermsPageProps {
  versions?: CollectionState<TermsVersion>;
  config?: DocState<PlatformConfig>;
  writer?: PlatformWriter;
}

type Errors = Partial<Record<'version' | 'termsMd' | 'privacyMd', string>>;

export function TermsPage({ versions: injectedVersions, config: injectedConfig, writer = firestorePlatformWriter }: TermsPageProps) {
  const { t } = useTranslation('superadmin');
  const { lang } = useLang();
  const toast = useToast();
  const liveVersions = useCollection<TermsVersion>(injectedVersions ? null : termsCollectionPath, orderBy('publishedAt', 'desc'));
  const liveConfig = useDoc<PlatformConfig>(injectedConfig ? null : paths.platform.config);
  const versionsState = injectedVersions ?? liveVersions;
  const config = injectedConfig ?? liveConfig;
  const versions = [...versionsState.data].sort((a, b) => b.publishedAt - a.publishedAt);
  const current = config.data?.currentTermsVersion;

  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [termsMd, setTermsMd] = useState('');
  const [privacyMd, setPrivacyMd] = useState('');
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  function openModal() {
    setVersion('');
    setTermsMd('');
    setPrivacyMd('');
    setErrors({});
    setOpen(true);
  }

  async function publish() {
    const id = version.trim();
    const e: Errors = {};
    if (!id) e.version = t('terms.errors.versionRequired');
    else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) e.version = t('terms.errors.versionFormat');
    else if (versions.some((v) => v.version === id)) e.version = t('terms.errors.duplicate');
    if (!termsMd.trim()) e.termsMd = t('terms.errors.termsRequired');
    if (!privacyMd.trim()) e.privacyMd = t('terms.errors.privacyRequired');
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await writer.publishTerms({ version: id, termsMd, privacyMd, publishedAt: Date.now() });
      toast.show(t('terms.published', { version: id }), 'success');
      setOpen(false);
    } catch (err) {
      if (err instanceof TermsExistsError) {
        setErrors({ version: t('terms.errors.duplicate') });
        return;
      }
      toast.show(t('terms.failed', { message: err instanceof Error ? err.message : String(err) }), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[26px] font-bold">{t('terms.title')}</h1>
          <p className="text-sm text-ink-muted">{t('terms.intro')}</p>
        </div>
        <Button variant="primary" onClick={openModal}>
          {t('terms.new')}
        </Button>
      </div>
      {versionsState.loading ? (
        <LoadingState />
      ) : versionsState.error ? (
        <EmptyState icon="search" title={t('terms.loadError')} />
      ) : versions.length === 0 ? (
        <EmptyState icon="search" title={t('terms.empty')} />
      ) : (
        <Table className="min-w-[520px]">
          <THead>
            <tr>
              <Th>{t('terms.columns.version')}</Th>
              <Th>{t('terms.columns.published')}</Th>
              <Th>{t('terms.columns.status')}</Th>
            </tr>
          </THead>
          <TBody>
            {versions.map((v) => (
              <Tr key={v.version}>
                <Td>
                  <strong>{v.version}</strong>
                </Td>
                <Td>{formatDate(v.publishedAt, lang)}</Td>
                <Td>
                  {v.version === current && (
                    <span className="rounded-full bg-[#E4F2E7] px-2.5 py-0.5 text-xs font-bold text-[#1F6B34]">{t('terms.current')}</span>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <Modal
        open={open}
        title={t('terms.newTitle')}
        width={640}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>{t('buttons.cancel', { ns: 'common' })}</Button>
            <Button variant="primary" disabled={busy || versionsState.loading || !!versionsState.error} onClick={() => void publish()}>
              {t('terms.publish')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="rounded-lg bg-[#FFF4DE] px-3 py-2 text-sm text-ink-soft">{t('terms.warning')}</p>
          <Field label={t('terms.fields.version')} hint={t('terms.fields.versionHint')} error={errors.version}>
            <input className={inputClass} value={version} onChange={(e) => setVersion(e.target.value)} />
          </Field>
          <Field label={t('terms.fields.terms')} error={errors.termsMd}>
            <textarea rows={6} className={`${inputClass} h-auto py-2 font-mono`} value={termsMd} onChange={(e) => setTermsMd(e.target.value)} />
          </Field>
          <Field label={t('terms.fields.privacy')} error={errors.privacyMd}>
            <textarea rows={6} className={`${inputClass} h-auto py-2 font-mono`} value={privacyMd} onChange={(e) => setPrivacyMd(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
