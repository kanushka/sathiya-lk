// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { grantSuper } from '../src/lib/grantSuper';

const email = process.argv[2];
if (!email) {
  console.error('Usage: pnpm --filter functions grant-super <email>');
  process.exit(1);
}

if (!getApps().length) initializeApp(process.env.GCLOUD_PROJECT ? { projectId: process.env.GCLOUD_PROJECT } : undefined);

grantSuper(getAuth(), email).then(
  ({ uid, claims }) => {
    console.log(`Granted super to ${email} (uid ${uid}). Claims: ${JSON.stringify(claims)}`);
    console.log('The user must sign out and back in (or refresh their token) for the claim to apply.');
  },
  (err: unknown) => {
    console.error(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  },
);
