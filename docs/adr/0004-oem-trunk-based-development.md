---
status: proposed
date: 2026-09-03
tags: delivery, cicd
title: OEM Aggregator trunk-based development
group: delivery
relates-to:
  - 0002
---

# ADR 0004: OEM Aggregator trunk-based development (`v{major}` trunk, currently `v16`; launch deploy + Octane automation)

**Audience:** OEM Engineering; QA; DevOps

## Issue

OEM needs a single integration trunk for Aggregator without changing how the QA **fleet** deploys. The current major version branch is that trunk: **`v{major}`**, **today `v16`**.

## Decision

### After merge

```architecture
direction: LR
nodes:
  - id: merge
    label: Feature branch merged to trunk
    kind: service
  - id: deploy
    label: Automatic deploy to launch
    kind: worker
  - id: octane
    label: Octane automation action
    kind: worker
  - id: tests
    label: Test automation on launch
    kind: service
  - id: revert
    label: Revert the merge
    kind: service
  - id: done
    label: Done — no QA autodeploy
    kind: external
edges:
  - from: merge
    to: deploy
  - from: deploy
    to: octane
  - from: octane
    to: tests
  - from: tests
    to: revert
    label: red
  - from: tests
    to: done
    label: green
```

1. Merge to `v{major}` **automatically deploys** the new version to **launch**.
2. That deploy **triggers Octane automation**.

## Group

Delivery / engineering process.

## Implications

- Launch + Octane is the post-merge test surface.

## Related decisions

- [ADR 0002](0002-api-gateway-pattern.md)
