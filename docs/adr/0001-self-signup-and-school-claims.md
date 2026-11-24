# 0001. Self sign-up, invite links and per-school claims

Status: accepted
Date: 2026-11-24

## Context
Teachers got an Auth account (synthetic email, generated password, printed slip) whenever an admin added them. Most never used it, and slips and resets were admin work. Claims `{ sid, role, tid? }` tied an account to one school. Options for proving a teacher is who they claim: staff ID alone (sequential, guessable), per-teacher codes for everyone (slips again), or email match plus admin approval.

## Decision
- Everyone signs in with Google (recommended) or a verified email and password. Adding a teacher creates only the record.
- Teachers link through a school invite link: one unlinked teacher with the same verified email links at once; otherwise staff ID plus admin approval. Admins can also send a 7-day one-use personal link. Tokens are 128-bit; personal links are stored as a SHA-256 hash only, the school link also keeps its token so admins can copy it again.
- Claims become `{ schools: { [sid]: { r: 'a' | 't', t? } }, super? }`, rebuilt from `members` docs by `syncClaims` after every membership change. At most 15 schools per account, to stay under the 1000-byte claims limit. Rules read the map; no extra document reads.
- School pages live under `/s/:sid/...`.

## Consequences
- No passwords or slips to manage; teachers who only want a printout never get an account.
- Existing `{ sid, role, tid }` accounts stop working, so the release needs a data wipe (`docs/deploy.md`).
- Unlink revokes refresh tokens, but an ID token stays valid for up to an hour.
- Every membership change must go through a function that calls `syncClaims`.
