// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
export { directoryFields, sameDirectory, type DirectoryDoc } from '@sathiya/core';

// Pending and rejected schools stay out of the public directory; a suspended school keeps its entry, shown as disabled.
export const listed = (status: unknown): boolean => status !== 'pending' && status !== 'rejected';
