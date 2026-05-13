# ADR 002: Use MongoDB-Backed TTS Queue First

## Status

Accepted

## Context

Article listen mode previously considered provider-generated TTS, but the
platform now avoids paid external TTS APIs and uses manually uploaded audio.

## Decision

Use existing MongoDB-backed TTS asset records for manual audio state. Public
requests return `ready` when an uploaded asset exists, otherwise the newsroom
uploads audio manually through the CMS.

## Consequences

This avoids Redis/BullMQ for the current scale. It is simpler to operate, but it
requires careful locking and diagnostics. If TTS volume grows, this queue can be
replaced by a dedicated worker system without changing the public response shape.
