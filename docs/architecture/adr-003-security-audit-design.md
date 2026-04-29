# ADR 003: Shared API Security And Audit Design

## Status

Accepted

## Context

Admin mutations need consistent authentication, permission checks, validation,
request logging, same-origin protection, and audit records. Middleware can see
requests early, but it cannot know the final route outcome.

## Decision

Use route-level wrappers for admin mutations. Middleware can still provide early
rate limiting and lightweight request logs, while wrappers record final response
status and mutation outcome.

## Consequences

Audit logs become more accurate. Routes become thinner and easier to test. New
admin mutations should use the shared wrapper by default.

