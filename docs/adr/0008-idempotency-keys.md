---
status: proposed
date: 2026-05-20
tags: api, reliability
title: Idempotency keys on write APIs
group: integration
relates-to:
  - 0002
---

# ADR 0008: Idempotency keys on write APIs

## Issue

Mobile clients retry POST requests on flaky networks, causing duplicate orders.

## Decision

Require **`Idempotency-Key`** on all mutating gateway routes. Store keys for 24 hours; return the original response on replay.

## Group

Integration (API edge).

## Implications

- Gateway middleware validates and caches responses.
- Clients must generate stable keys per user intent.

## Related decisions

- [ADR 0002](./0002-api-gateway-pattern.md)
