// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { FirebaseOptions } from 'firebase/app';

const shared = {
  apiKey: 'AIzaSyAAV1VrII8O9l5UKfpybQijC5CRTss_rUE',
  authDomain: 'app.sathiya.kanushka.com',
  projectId: 'sathiya-lk',
  storageBucket: 'sathiya-lk.firebasestorage.app',
  messagingSenderId: '591171596099',
} satisfies FirebaseOptions;

export const webConfig: FirebaseOptions = {
  ...shared,
  appId: '1:591171596099:web:f4363f68c921388b0489f6',
  measurementId: 'G-Z7BE11T4C9',
};

export const appConfig: FirebaseOptions = {
  ...shared,
  appId: '1:591171596099:web:6d617b8424ab69cd0489f6',
  measurementId: 'G-DZ47PXT701',
};

// Placeholders: replace with the staging project's web app config (Firebase console > Project settings) after creating it. Public values, not secrets.
const stagingShared = {
  apiKey: 'REPLACE_WITH_STAGING_API_KEY',
  authDomain: 'sathiya-lk-staging.firebaseapp.com',
  projectId: 'sathiya-lk-staging',
  storageBucket: 'sathiya-lk-staging.firebasestorage.app',
  messagingSenderId: 'REPLACE_WITH_STAGING_SENDER_ID',
} satisfies FirebaseOptions;

export const stagingWebConfig: FirebaseOptions = {
  ...stagingShared,
  appId: 'REPLACE_WITH_STAGING_WEB_APP_ID',
};

export const stagingAppConfig: FirebaseOptions = {
  ...stagingShared,
  appId: 'REPLACE_WITH_STAGING_APP_APP_ID',
};

export const appConfigFor = (env: string | undefined): FirebaseOptions => (env === 'staging' ? stagingAppConfig : appConfig);
export const webConfigFor = (env: string | undefined): FirebaseOptions => (env === 'staging' ? stagingWebConfig : webConfig);
