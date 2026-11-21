// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan

import type { FirebaseOptions } from 'firebase/app';

const shared = {
  apiKey: 'AIzaSyAAV1VrII8O9l5UKfpybQijC5CRTss_rUE',
  authDomain: 'sathiya-lk.firebaseapp.com',
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
