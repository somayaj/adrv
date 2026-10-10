---
status: proposed
date: 2026-06-01
tags: delivery, product
title: Feature flags via LaunchDarkly
group: delivery
relates-to:
  - 0004
---

# ADR 0009: Feature flags via LaunchDarkly

## Issue

OEM trunk-based delivery needs safe gradual rollouts without long-lived release branches.

## Decision

Use **LaunchDarkly** for feature flags tied to trunk merges. Flags default off; enable per environment and cohort.

## Group

Delivery / product.

## Implications

- Flag hygiene reviews each sprint (remove stale flags).
- Aligns with trunk-based flow in ADR 0004.

## Related decisions

- [ADR 0004](./0004-oem-trunk-based-development.md)
