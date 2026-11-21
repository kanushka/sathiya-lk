// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Kanushka Gayan
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { auth } from '../../lib/firebase';

export type ChangePasswordFn = (currentPassword: string, newPassword: string) => Promise<void>;

export const changePasswordWithFirebase: ChangePasswordFn = async (currentPassword, newPassword) => {
  const user = auth.currentUser;
  if (!user?.email) throw new Error('not-signed-in');
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, currentPassword));
  await updatePassword(user, newPassword);
};
