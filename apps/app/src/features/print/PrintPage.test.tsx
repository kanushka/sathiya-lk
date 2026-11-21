// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { testI18n } from '../../test/render';
import { PrintPage } from './PrintPage';

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

function renderPage(children = <div className="print-sheet">sheet</div>) {
  return render(
    <I18nextProvider i18n={testI18n}>
      <MemoryRouter>
        <PrintPage status="ready" auto notFoundTitle="" notFoundBody="" icon="classView">
          {children}
        </PrintPage>
      </MemoryRouter>
    </I18nextProvider>,
  );
}

const flush = () => act(async () => {});

let print: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
  Reflect.deleteProperty(document, 'fonts');
});

describe('PrintPage auto print', () => {
  it('waits for fonts before printing, then prints once', async () => {
    const fonts = deferred();
    Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: fonts.promise } });
    const view = renderPage();
    await flush();
    expect(print).not.toHaveBeenCalled();
    fonts.resolve();
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
    view.rerender(
      <I18nextProvider i18n={testI18n}>
        <MemoryRouter>
          <PrintPage status="ready" auto notFoundTitle="" notFoundBody="" icon="classView">
            <div className="print-sheet">again</div>
          </PrintPage>
        </MemoryRouter>
      </I18nextProvider>,
    );
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('prints when document.fonts is missing', async () => {
    renderPage();
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('waits for the logo to load', async () => {
    renderPage(
      <div className="print-sheet">
        <img src="https://example.test/logo.png" alt="logo" />
      </div>,
    );
    await flush();
    expect(print).not.toHaveBeenCalled();
    fireEvent.load(screen.getByAltText('logo'));
    await flush();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('prints after a timeout when the logo never loads', async () => {
    vi.useFakeTimers();
    renderPage(
      <div className="print-sheet">
        <img src="https://example.test/logo.png" alt="logo" />
      </div>,
    );
    await flush();
    expect(print).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(print).toHaveBeenCalledTimes(1);
  });
});
