# 0003. Census-first registration and school review

Status: accepted
Date: 2026-11-25

## Context
Any verified account could register any school name and census number, and the school went live in the public directory at once, so fake or duplicate schools were easy to create. The Ministry of Education publishes the official school list with census numbers. Options:
- A. Census list as the trust anchor: listed schools go live at once, unlisted ones wait for review.
- B. Review every registration: safest, but slow for every school and loads the owner.
- C. List-only registration, no review: blocks private schools and schools opened after the list.

## Decision
- A. Registration asks for the census number first. A number in the MOE list (`functions/src/data/moeSchools.json`, built from the MOE PDFs) prefills the official details, locks the English name and makes the school `active`; super admins get an FYI email.
- A number not in the list, or no number, makes the school `pending`: hidden from the directory, no publishing, invites, links or joining, but setup and draft editing work. Super admins get a review email with possible duplicates.
- A super admin approves (active, directory entry, admin emailed) or rejects with a reason (`rejected`, census number released, admin emailed and shown a "Not approved" screen with "Remove registration").
- The server re-checks the list: a listed number always uses the list's name. Reviewed schools cannot change `nameEn`, `district` or `censusNo` themselves.

## Consequences
- Real government schools register without waiting; fake names for listed numbers are no longer possible. Impersonating a real listed school is still possible and is handled by the FYI email, reports and suspend.
- The MOE JSON must be refreshed by hand when MOE publishes new lists (see `docs/deploy.md`).
- `School.status` now has four values (`active`, `disabled`, `pending`, `rejected`), and every school-scoped callable that shares data must check approval.
