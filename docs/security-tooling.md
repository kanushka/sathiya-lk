# Security tooling

What runs on this repository, and the GitHub settings and app installs a maintainer must turn on by hand.

## What runs

| Tool | Where | When | Blocks merge? |
| --- | --- | --- | --- |
| CodeRabbit | GitHub App, config in `.coderabbit.yaml` | every non-draft PR | no (comments only) |
| Trivy (`trivy.yml`) | filesystem scan: `pnpm-lock.yaml` vulnerabilities, secrets, IaC misconfig | PRs, pushes to `main`, Mondays, deploys | report-only on PRs and pushes (results in **Security → Code scanning**); blocking in the staging and production deploy workflows (fixable CRITICAL/HIGH) |
| CodeQL (`codeql.yml`) | JavaScript/TypeScript and GitHub Actions, `security-extended` queries | PRs, pushes to `main`, Tuesdays, deploys | only if made a required check; blocking in the deploy workflows (open high/critical alerts) |
| OpenSSF Scorecard (`scorecard.yml`) | repo supply-chain posture, badge in the README | pushes to `main`, Wednesdays, branch protection changes | no |
| Dependabot (`.github/dependabot.yml`) | npm (pnpm workspace) and GitHub Actions | weekly, Mondays (Asia/Colombo), 7-day cooldown | n/a (opens PRs) |
| GitHub secret scanning + push protection | GitHub-side | every push | push protection blocks pushes with known secrets |

Trivy also scans for secrets as a second layer. There is no gitleaks job: GitHub secret scanning is free for public repos, scans the whole history, and push protection stops a leak before it lands, which gitleaks in CI can't.

Trivy and CodeQL stay report-only on PRs and pushes. The deploy workflows call both with `blocking: true`: Trivy adds a second scan (`severity: CRITICAL,HIGH`, `ignore-unfixed: true`, `exit-code: '1'`) after the SARIF upload, and CodeQL adds a `gate` job that fails while `main` (or the deployed ref) has open high or critical CodeQL alerts. Fix or dismiss (with a reason) the finding, then deploy again.

Trivy has no checks for `firebase.json`, `*.rules` or GitHub workflows; the CodeQL `actions` language and the CodeRabbit path instructions cover the workflows, and `tests/rules` covers the security rules.

All workflow actions are pinned by commit SHA with a version comment. Dependabot bumps the SHA and the comment together.

Dependabot ignores `@types/node` majors because CI runs Node 22 (`.nvmrc`). pnpm itself is pinned to 9 in the workflows, not by Dependabot.

## Maintainer checklist

These need repo admin rights; they can't be done from a PR.

### Settings → Code security

- [ ] **Dependency graph**: on (default for public repos).
- [ ] **Dependabot alerts**: on.
- [ ] **Dependabot security updates**: on.
- [ ] **Grouped security updates**: on.
- [ ] **Secret scanning**: on.
- [ ] **Push protection**: on.
- [ ] **Private vulnerability reporting**: on (`SECURITY.md` links to it).
- [ ] **Code scanning**: leave **CodeQL default setup off**; the advanced `codeql.yml` workflow replaces it and the two conflict.

### Apps

- [ ] Install the **CodeRabbit** GitHub App (free for public repos): https://github.com/apps/coderabbitai → **Configure** → **Only select repositories** → `sathiya-lk`. Sign in at https://app.coderabbit.ai with GitHub once to activate it. It reads `.coderabbit.yaml` from the PR's base branch, so it applies after this PR merges.

### Branch protection / rulesets for `main`

- [ ] Keep `ci-fast`, `ci-emulators`, `ci-e2e` as required checks (names unchanged).
- [ ] Optional: add `analyze (javascript-typescript)` (CodeQL) as a required check.
- [ ] Optional: under **Code scanning** in the ruleset, block merges on CodeQL alerts of severity High or above.
- [ ] Don't make `trivy-fs` required while it's report-only.

### After the first runs on `main`

- [ ] **Security → Code scanning**: triage the Trivy and CodeQL alerts (dismiss false positives with a reason).
- [ ] Check the Scorecard badge in the README renders (it appears after the first `scorecard.yml` run on `main`).
