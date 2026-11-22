// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

class MemoryStorage implements Storage {
  private map = new Map<string, string>();
  get length() {
    return this.map.size;
  }
  clear() {
    this.map.clear();
  }
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
}

// Node >= 25 ships an experimental global localStorage that shadows jsdom's and is unusable without a file.
for (const name of ['localStorage', 'sessionStorage'] as const) {
  if (typeof globalThis[name]?.clear !== 'function') {
    Object.defineProperty(globalThis, name, { value: new MemoryStorage(), configurable: true, writable: true });
  }
}

const readBlob = <T>(blob: Blob, read: (r: FileReader) => void) =>
  new Promise<T>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as T);
    r.onerror = () => reject(r.error);
    read(r);
  });

// jsdom's Blob lacks text()/arrayBuffer(), which browsers and read-excel-file rely on
Blob.prototype.text ??= function (this: Blob) {
  return readBlob<string>(this, (r) => r.readAsText(this));
};
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return readBlob<ArrayBuffer>(this, (r) => r.readAsArrayBuffer(this));
};

if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => undefined;

afterEach(() => {
  cleanup();
  localStorage.clear();
});
