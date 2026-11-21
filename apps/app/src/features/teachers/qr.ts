// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import QRCode from 'qrcode';

export async function qrSvgDataUri(text: string): Promise<string> {
  const svg = await QRCode.toString(text, { type: 'svg', margin: 1 });
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
