import { paths, type ClaimInvitesRes, type Member, type School } from '@sathiya/core';
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
  // Claims are set before the invite is consumed (both idempotent), so a failure leaves the invite for a retry.
  const current = (await auth.getUser(uid)).customClaims ?? {};
  let sid = current.sid as string | undefined;
  const invites = await db.collectionGroup(INVITES).where('email', '==', email).get();
  const claimed: string[] = [];
  for (const doc of invites.docs) {
    const inviteSid = doc.ref.parent.parent!.id;
    if (sid && sid !== inviteSid) continue;
    const memberRef = db.doc(`${paths.members(inviteSid)}/${uid}`);
    const [school, member] = await Promise.all([db.doc(paths.school(inviteSid)).get(), memberRef.get()]);
    if ((school.data() as School | undefined)?.status !== 'active') continue;
    const tid =
      (doc.data() as Invite).teacherId ??
      (member.data() as Member | undefined)?.teacherId ??
      (current.sid === inviteSid ? (current.tid as string | undefined) : undefined);

    await setSchoolClaims(uid, { sid: inviteSid, role: 'admin', tid });
    sid = inviteSid;
    await db.runTransaction(async (tx) => {
      const invite = await tx.get(doc.ref);
      tx.set(memberRef, { uid, role: 'admin', email, teacherId: tid });
      if (invite.exists) tx.delete(doc.ref);
    });
    claimed.push(inviteSid);
  }
  return { schoolIds: claimed };
});
