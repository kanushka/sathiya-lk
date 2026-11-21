import { paths, type ClaimInvitesRes, type School } from '@sathiya/core';
import { onCall } from 'firebase-functions/v2/https';
import { auth, db } from './lib/admin';
import { callOpts } from './lib/callOptions';
import { setSchoolClaims } from './lib/claims';
import { notAllowed, requireAuth } from './lib/guards';

const INVITES = paths.invites('_').split('/').pop()!;

interface Invite {
  email: string;
  teacherId?: string;
}

export const claimInvites = onCall(callOpts, async (req): Promise<ClaimInvitesRes> => {
  const { uid, token } = requireAuth(req);
  const verified = token.email_verified === true || token.firebase.sign_in_provider === 'google.com';
  if (!token.email || !verified) notAllowed('A verified email is required');
  const email = token.email!.toLowerCase();

  // Claims hold one school: claim the first invite of an active school, or any for the school the user already belongs to.
  let sid = (await auth.getUser(uid)).customClaims?.sid as string | undefined;
  const invites = await db.collectionGroup(INVITES).where('email', '==', email).get();
  const claimed: string[] = [];
  for (const doc of invites.docs) {
    const inviteSid = doc.ref.parent.parent!.id;
    if (sid && sid !== inviteSid) continue;
    const teacherId = await db.runTransaction(async (tx) => {
      const [invite, school] = await Promise.all([tx.get(doc.ref), tx.get(db.doc(paths.school(inviteSid)))]);
      if (!invite.exists || (school.data() as School | undefined)?.status !== 'active') return null;
      const { teacherId } = invite.data() as Invite;
      tx.set(db.doc(`${paths.members(inviteSid)}/${uid}`), { uid, role: 'admin', email, teacherId });
      tx.delete(doc.ref);
      return teacherId ?? '';
    });
    if (teacherId === null) continue;
    await setSchoolClaims(uid, { sid: inviteSid, role: 'admin', tid: teacherId || undefined });
    sid = inviteSid;
    claimed.push(inviteSid);
  }
  return { schoolIds: claimed };
});
