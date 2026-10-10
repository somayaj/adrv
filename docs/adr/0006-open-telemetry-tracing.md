---
status: proposed
date: 2026-04-15
tags: observability, ops
title: OpenTelemetry for distributed tracing
group: integration
relates-to:
  - 0002
  - 0003
---

# ADR 0006: OpenTelemetry for distributed tracing

## Issue

Requests cross the API gateway, multiple services, and JetStream consumers. Incidents are hard to debug without correlated traces.

## Decision

Standardize on **OpenTelemetry** SDKs in all services. Export traces to the shared collector; retain 14 days in the backend.

## Group

Integration / observability.

## Implications

- Gateway and services add trace context propagation headers.
- Sampling at 10% in production unless an incident flag raises it.

## Related decisions

- [ADR 0002](./0002-api-gateway-pattern.md)
- [ADR 0003](./0003-nats-jetstream-event-bus.md)
