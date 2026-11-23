# Architecture decision records

One file per decision that is hard to reverse or that a new contributor would ask "why?" about (a platform, a data shape, a security model). Small or feature-level decisions go in the feature's `spec` issue instead.

Name files `NNNN-short-title.md` (`0001-firebase-only.md`), numbered in order. Never edit an accepted ADR's decision; write a new one that supersedes it.

## Template

```markdown
# NNNN. Title

Status: proposed | accepted | superseded by NNNN
Date: YYYY-MM-DD

## Context
What forces the decision: the problem, constraints, options considered.

## Decision
What we chose.

## Consequences
What gets easier, what gets harder, what we now have to keep doing.
```
