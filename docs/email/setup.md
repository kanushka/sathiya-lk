# Email setup (user steps)

App emails (invites, welcome, reports, suspend/reactivate) and Firebase Auth emails (verify, password reset) are all sent the same way: functions write a doc to Firestore `mail`, the **Trigger Email from Firestore** extension sends it through Resend SMTP. Teachers never get email.

## 1. Resend
1. Resend → Domains → add `sathiya.kanushka.com`.
2. Add the DNS records Resend shows at the DNS host of `kanushka.com`: SPF (TXT), DKIM (TXT/CNAME) and the return-path (MX/CNAME). Wait until the domain shows "Verified".
3. Resend → API Keys → create a key with "Sending access" for that domain. Keep it for step 2.

## 2. Trigger Email extension
Firebase console → Extensions → install "Trigger Email from Firestore" (project `sathiya-lk`):
- Email documents collection: `mail`
- SMTP connection URI: `smtps://resend@smtp.resend.com:465` (host `smtp.resend.com`, port 465, user `resend`)
- SMTP password: the Resend API key, stored as the extension's Secret Manager secret
- Default FROM: `Sathiya <noreply@sathiya.kanushka.com>`; default REPLY-TO: `sathiya@kanushka.com`
- Leave users/templates collections empty (functions send finished HTML).

## 3. Functions parameters (defaults already match this setup)
| Param | Default |
|---|---|
| `MAIL_FROM` | `Sathiya <noreply@sathiya.kanushka.com>` |
| `MAIL_REPLY_TO` | `sathiya@kanushka.com` (invites use the inviting admin's email instead) |
| `APP_URL` | `https://app.sathiya.kanushka.com` |
| `WEB_URL` | `https://sathiya.kanushka.com` |
| `SUPER_EMAILS` | empty: comma-separated super admin addresses that get "report received" emails; none = no report emails |
| `MAIL_SUBJECT_PREFIX` | empty: prepended to every subject; staging sets `[staging]` in `functions/.env.sathiya-lk-staging` |

Override in `functions/.env.sathiya-lk` (kept out of git if it holds addresses you don't want public), then `firebase deploy --only functions`.

## 4. Firebase console (Authentication)
- Templates → set the email action URL (Customize action URL) to `https://app.sathiya.kanushka.com/auth/action` (only needed while Firebase's own template emails are used; `sendAuthEmail` links go to `${APP_URL}/login`).
- Settings → Authorized domains → add `app.sathiya.kanushka.com`.

## 5. Hosting custom domains
Firebase console → Hosting: connect `sathiya.kanushka.com` to the `web` site and `app.sathiya.kanushka.com` to the `app` site; add the DNS records it shows.

## 6. Check
Register a test school with a real address: the welcome email should arrive and the `mail` doc shows `delivery.state: SUCCESS`. Check SPF/DKIM pass in the message headers.
