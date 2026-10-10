---
status: accepted
date: 2026-05-01
tags: security, platform
title: Central secrets in HashiCorp Vault
group: platform
depends-on:
  - 0002
---

# ADR 0007: Central secrets in HashiCorp Vault

## Issue

Service teams store credentials in environment variables and CI variables with inconsistent rotation.

## Decision

1. Move application secrets to **Vault** dynamic credentials where supported.
2. Gateway TLS certificates and DB passwords rotate on a 90-day schedule.
3. No long-lived secrets in git or static K8s manifests.

## Group

Platform / security.

## Implications

- Bootstrap complexity for local dev (dev namespace in Vault).
- All services depend on Vault availability at startup.

## Related decisions

- [ADR 0002](./0002-api-gateway-pattern.md)
