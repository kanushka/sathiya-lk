import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { AdminLoginForm } from './AdminLoginForm';
import { BrandMark, LanguageToggle } from './AuthChrome';
import { TeacherLoginForm } from './TeacherLoginForm';

export function LoginPage() {
  const { t } = useTranslation('auth');
  const [params] = useSearchParams();
  const teacherFirst = params.get('as') === 'teacher';

  return (
    <div className="flex min-h-screen flex-col items-center bg-ground px-4 py-10 sm:py-12">
      <div className="mb-3 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-2xl font-extrabold">{t('brand')}</span>
      </div>
      <p className="mb-9 mt-0 text-ink-muted">{t('choose')}</p>
      <div className="flex w-full max-w-[980px] flex-wrap justify-center gap-6">
        <TeacherLoginForm focus={teacherFirst} />
        <AdminLoginForm />
      </div>
      <div className="mt-8">
        <LanguageToggle />
      </div>
    </div>
  );
}
