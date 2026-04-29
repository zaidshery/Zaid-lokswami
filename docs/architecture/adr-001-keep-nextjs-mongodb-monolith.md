# ADR 001: Keep The Next.js + MongoDB Monolith

## Status

Accepted

## Context

Lokswami combines reader surfaces, admin CMS, newsroom workflow, analytics, and
operational tooling. The current team benefits from one deployable application,
one authentication context, and one database.

## Decision

Keep the monolith as the production architecture. Formalize internal boundaries
instead of splitting services:

- route handlers in `app/api`
- request/auth/security helpers in `lib/api` and `lib/security`
- domain workflows in `lib/server`
- MongoDB models in `lib/models`

## Consequences

This keeps deployment simple and reduces coordination cost. If traffic or team
size grows enough to require independent scaling, the documented boundaries make
future extraction easier.

