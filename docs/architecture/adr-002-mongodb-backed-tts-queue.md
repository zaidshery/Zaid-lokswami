# ADR 002: Use MongoDB-Backed TTS Queue First

## Status

Accepted

## Context

Article listen mode can call Gemini TTS, which is too slow for reader-facing
request latency when audio is not already cached.

## Decision

Use existing MongoDB-backed TTS asset records as the first queue layer. Public
requests return a state (`ready`, `queued`, `processing`, or `failed`) and a
worker route/script performs due generation.

## Consequences

This avoids Redis/BullMQ for the current scale. It is simpler to operate, but it
requires careful locking and diagnostics. If TTS volume grows, this queue can be
replaced by a dedicated worker system without changing the public response shape.

