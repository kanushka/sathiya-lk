// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

export interface AnchorRect {
  top: number;
  bottom: number;
  left: number;
  width: number;
}

export interface Placement {
  placement: 'below' | 'above';
  top: number;
  left: number;
  width: number;
  maxHeight: number;
}

const GAP = 6;
const MARGIN = 8;

export function placePopover(args: { anchor: AnchorRect; contentHeight: number; viewportHeight: number }): Placement {
  const { anchor, contentHeight, viewportHeight } = args;
  const spaceBelow = viewportHeight - anchor.bottom - GAP - MARGIN;
  const spaceAbove = anchor.top - GAP - MARGIN;
  const above = contentHeight > spaceBelow && spaceAbove > spaceBelow;
  const maxHeight = Math.max(0, Math.min(contentHeight, above ? spaceAbove : spaceBelow));
  const top = above ? anchor.top - GAP - maxHeight : anchor.bottom + GAP;
  return { placement: above ? 'above' : 'below', top, left: anchor.left, width: anchor.width, maxHeight };
}
