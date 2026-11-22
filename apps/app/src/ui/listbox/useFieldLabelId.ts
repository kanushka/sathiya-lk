// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import { useLayoutEffect, useState, type RefObject } from 'react';

export function useFieldLabelId(
  triggerRef: RefObject<HTMLButtonElement>,
  active: boolean,
  baseId: string,
): string | undefined {
  const [labelId, setLabelId] = useState<string>();
  useLayoutEffect(() => {
    if (!active) return;
    const label = triggerRef.current?.labels?.[0];
    if (label && !label.id) label.id = `${baseId}-label`;
    setLabelId(label?.id);
  }, [active, triggerRef, baseId]);
  return labelId;
}
