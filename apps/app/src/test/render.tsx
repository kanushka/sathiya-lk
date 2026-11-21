import { createI18n } from '@sathiya/i18n';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

export const testI18n = createI18n('en');

export function renderWithI18n(ui: ReactElement, options?: RenderOptions) {
  return render(ui, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
    ),
    ...options,
  });
}
