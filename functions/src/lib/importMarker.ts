// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import type { DocumentReference } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';

// A marker left behind after an import that created nothing refuses that same file for 24 hours.
export async function releaseImportMarker(marker: DocumentReference, sid: string, attempts = 3): Promise<boolean> {
  for (let i = 1; ; i++) {
    try {
      await marker.delete();
      return true;
    } catch (e) {
      if (i >= attempts) {
        const { code } = (e ?? {}) as { code?: unknown };
        logger.error('importSetup could not release the re-import marker', { sid, marker: marker.id, code: String(code ?? 'unknown') });
        return false;
      }
      await new Promise((r) => setTimeout(r, 100 * 2 ** i));
    }
  }
}
