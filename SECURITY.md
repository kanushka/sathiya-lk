# Security policy

## Reporting a vulnerability

Please do not report security issues in public GitHub issues, discussions or pull requests.

Report them privately through GitHub's private vulnerability reporting: go to the repository's **Security** tab → **Report a vulnerability** ([direct link](https://github.com/kanushka/sathiya-lk/security/advisories/new)).

Include:

- what the issue is and what an attacker could do with it;
- steps to reproduce, or a proof of concept;
- the affected part (app, website, functions, security rules) and URL if relevant.

Please test only against your own local setup (`pnpm dev:local`) or your own accounts. Don't access other schools' data, run denial-of-service tests, or send spam through the live service.

## What to expect

We will acknowledge your report, investigate, and keep you updated on the fix. Please give us reasonable time to fix the issue before disclosing it. We are happy to credit you in the advisory if you wish.

## Supported versions

Only the current `main` branch, which is what runs at https://app.sathiya.kanushka.com, receives security fixes.
