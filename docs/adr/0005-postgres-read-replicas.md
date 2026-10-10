---
status: accepted
date: 2026-04-01
tags: database, reliability
title: PostgreSQL read replicas for reporting
group: data
depends-on:
  - 0002
---

# ADR 0005: PostgreSQL read replicas for reporting

## Issue

Catalog and order services share PostgreSQL. Analytical queries and dashboards compete with transactional writes on the primary.

## Decision

1. Keep a single **write primary** per domain database.
2. Route read-only reporting and internal BI to **async replicas**.
3. Document replication lag SLO (target under 30s) in runbooks.

## Group

Data / persistence.

## Implications

- Applications must tag connections as read vs write.
- Stale reads are acceptable for dashboards; not for payment confirmation.

## Related decisions

- [ADR 0002](./0002-api-gateway-pattern.md)
