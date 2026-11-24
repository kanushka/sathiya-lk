# Email setup (user steps)

App emails (invites, welcome, reports, suspend/reactivate) and Firebase Auth emails (verify, password reset) are all sent the same way: functions write a doc to Firestore `mail`, and the `sendMail` function (a `mail/{id}` create trigger, `functions/src/email/sendMail.ts`) sends it with the [Resend HTTP API](https://resend.com/docs/api-reference/emails/send-email). Teachers get only the Auth emails (verify, password reset) when they sign up with email and password; invite links are copied and shared by the admin, not emailed. Clients can't read or write `mail` (rules deny it).

## 1. Resend
1. Resend → Domains → add `sathiya.kanushka.com`.
2. Add the DNS records Resend shows at the DNS host of `kanushka.com`: SPF (TXT), DKIM (TXT/CNAME) and the return-path (MX/CNAME). Wait until the domain shows "Verified". Until then Resend answers `403` and every mail ends in `delivery.state: ERROR`.
3. Resend → API Keys → create a key with "Sending access" for `sathiya.kanushka.com` (or full access).

## 2. API key secret
`sendMail` reads the key from the Secret Manager secret `RESEND_API_KEY`. Set it once per project:
```bash
firebase functions:secrets:set RESEND_API_KEY -P <alias>
```
- Production (`sathiya-lk`): already set.
- Staging: set it before the first functions deploy that includes `sendMail`, or the deploy fails on the missing secret.
- To rotate, run the same command and redeploy functions (`firebase deploy --only functions:sendMail -P <alias>`).

Deploying a function that uses a secret also needs the deploying account to read the secret and grant the runtime service account access to it: the CI service accounts (`FIREBASE_SERVICE_ACCOUNT_*`) need the **Secret Manager Admin** role. No GitHub secret is involved.

The function never logs the key. In the emulator, or when the secret is empty, it does not call Resend: it logs a dry run and marks the doc `SUCCESS` with `delivery.info.dryRun: true`, so `pnpm dev:local` and e2e need no key.

## 3. Functions parameters (defaults already match this setup)
| Param | Default |
|---|---|
| `MAIL_FROM` | `Sathiya <noreply@sathiya.kanushka.com>` (must be on the verified Resend domain) |
| `MAIL_REPLY_TO` | `sathiya@kanushka.com` (invites use the inviting admin's email instead) |
| `APP_URL` | `https://app.sathiya.kanushka.com` |
| `WEB_URL` | `https://sathiya.kanushka.com` |
| `SUPER_EMAILS` | empty: comma-separated super admin addresses that get "report received" emails; none = no report emails |
| `MAIL_SUBJECT_PREFIX` | empty: prepended to every subject; staging sets `[staging]` in `functions/.env.sathiya-lk-staging` |

Override in `functions/.env.sathiya-lk` (kept out of git if it holds addresses you don't want public), then `firebase deploy --only functions`.

## 4. Delivery status
`sendMail` writes `delivery` on each `mail` doc, in the same shape the old Trigger Email extension used:

| Field | Meaning |
|---|---|
| `state` | `PROCESSING` (claimed, sending), `SUCCESS` or `ERROR` |
| `leaseExpireTime` | while `PROCESSING`: when the claim lapses (3 min); cleared when done |
| `attempts` | requests made to Resend (0 for a dry run) |
| `startTime`, `endTime` | server timestamps |
| `info.messageId` | Resend email id (look it up in Resend → Emails); `info.dryRun: true` when nothing was sent |
| `error` | why it failed, e.g. `403 validation_error: The sathiya.kanushka.com domain is not verified…`; `null` on success |

To read it: Firebase console → Firestore → `mail`, sort or filter by `delivery.state == ERROR`, open the doc. The same error is in the function logs (`firebase functions:log --only sendMail`).

- Network errors, `429` and `5xx` are retried up to 3 times (1 s, 2 s, 4 s backoff) with the doc id as Resend's `Idempotency-Key`, so a retry can't send twice.
- Other `4xx` (bad key, unverified domain, invalid address) are not retried: fix the cause; the mail is not resent automatically. To resend one doc, delete its `delivery` field and copy the doc to a new `mail` doc (only creates trigger a send).
- A doc in `SUCCESS` or `ERROR` is never sent again, so a duplicate trigger event is a no-op.
- The function has a 120 s timeout and event retry on. If a run dies before writing the final state (timeout, crash, failed write), the doc stays `PROCESSING` until its lease lapses; the retried event then reclaims and resends it, and the same `Idempotency-Key` keeps Resend from sending twice.

## 5. Firebase console (Authentication)
- No custom action URL is needed. `sendAuthEmail` takes the links from `generateEmailVerificationLink` / `generatePasswordResetLink` (which point at `…firebaseapp.com/__/auth/action`) and rebuilds them as `${APP_URL}/auth/action?mode=…&oobCode=…&apiKey=…&lang=…&continueUrl=…` (`functions/src/email/actionLink.ts`). The console's "Customize action URL" can fail with `EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED` on new projects; leave it at the default. This only covers mails `sendAuthEmail` sends; any email Firebase sends itself (e.g. recoverEmail after an email change, none today) still uses the default handler.
- Settings → Authorized domains → add `app.sathiya.kanushka.com` (`${APP_URL}/login` is the links' `continueUrl`, so its domain must be authorized).

## 6. Hosting custom domains
Firebase console → Hosting: connect `sathiya.kanushka.com` to the `web` site and `app.sathiya.kanushka.com` to the `app` site; add the DNS records it shows.

## 7. Moving off the Trigger Email extension
Projects that had the "Trigger Email from Firestore" extension installed: deploy functions first (so `sendMail` exists), then **uninstall the extension** (Firebase console → Extensions → Trigger Email → Uninstall, or `firebase ext:uninstall firestore-send-email -P <alias>`). While both are live, both would send each new mail. The extension's own SMTP secret can be deleted after uninstalling. Old `mail` docs keep the `delivery` the extension wrote.

## 8. Check
Register a test school with a real address: the welcome email should arrive and the `mail` doc shows `delivery.state: SUCCESS` with an `info.messageId`. Check SPF/DKIM pass in the message headers.
