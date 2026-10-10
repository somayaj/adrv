---
status: proposed
date: 2026-03-10
tags: messaging, events
title: NATS JetStream for domain events
group: integration
relates-to:
  - 0002
---

# ADR 0003: NATS JetStream for domain events

## Issue

Order fulfillment needs async notifications without coupling services through the gateway.

## Decision

Adopt **NATS JetStream** for domain events. The gateway remains HTTP-only; services publish and subscribe on the bus.

## Group

Integration (async / messaging).

## Implications

- New operational surface (streams, consumers, replay).
- Event schemas must be versioned.

## Related decisions

- [ADR 0002](./0002-api-gateway-pattern.md) — sync path vs async path.

## Architecture

```architecture
direction: TB
nodes:
  - id: gw
    label: API Gateway
    kind: gateway
  - id: orders
    label: Order service
    kind: service
  - id: pg
    label: PostgreSQL
    kind: database
  - id: bus
    label: NATS JetStream
    kind: queue
  - id: fulfill
    label: Fulfillment worker
    kind: worker
  - id: analytics
    label: Analytics projector
    kind: worker
edges:
  - from: gw
    to: orders
  - from: orders
    to: pg
  - from: orders
    to: bus
    label: publish
    async: true
  - from: bus
    to: fulfill
    async: true
  - from: bus
    to: analytics
    async: true
  - from: fulfill
    to: pg
```
