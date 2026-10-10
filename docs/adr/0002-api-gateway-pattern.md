---
status: accepted
date: 2026-02-01
tags: api, edge
title: API gateway at the edge
group: integration
---

# ADR 0002: API gateway at the edge

## Issue

Multiple backend services need a single public entry point for auth, rate limits, and routing.

## Decision

Place an **API gateway** in front of internal services. All north-south traffic passes through it.

## Group

Integration (edge / north-south).

## Implications

- Gateway becomes a critical path; deploy HA pairs.
- Service teams publish OpenAPI specs for route registration.

## Architecture

```architecture
direction: TB
nodes:
  - id: clients
    label: Clients
    kind: client
  - id: gw
    label: API Gateway
    kind: gateway
  - id: orders
    label: Order service
    kind: service
  - id: catalog
    label: Catalog service
    kind: service
  - id: pg
    label: PostgreSQL
    kind: database
edges:
  - from: clients
    to: gw
  - from: gw
    to: orders
  - from: gw
    to: catalog
  - from: orders
    to: pg
  - from: catalog
    to: pg
```
