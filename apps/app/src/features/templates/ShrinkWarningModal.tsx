
import { useTranslation } from 'react-i18next';
import { Button } from '../../ui/Button';
import { Modal } from '../../ui/Modal';

export interface ShrinkWarningModalProps {
  count: number;
  onConfirm: () => void;
  onClose: () => void;
}

export function ShrinkWarningModal({ count, onConfirm, onClose }: ShrinkWarningModalProps) {
  const { t } = useTranslation('templates');
  return (
    <Modal
      open
      width={460}
      title={t('shrink.title')}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>{t('shrink.cancel')}</Button>
          <Button variant="primary" onClick={onConfirm}>
            {t('shrink.confirm')}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-soft">{t('shrink.body', { count })}</p>
    </Modal>
  );
}
