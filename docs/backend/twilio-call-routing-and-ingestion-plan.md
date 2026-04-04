# Twilio Call Routing and Ingestion Plan

## Purpose

This document captures:

1. what we currently have for call simulation/routing behavior,
2. the target Twilio-driven call-routing and transcription event model,
3. how both should converge on the same ingestion contract to avoid downstream rework.

This is a planning artifact only. It does **not** introduce implementation changes.

---

## 1) Current State (What We Have Today)

### 1.1 Agent-triggered call completion simulation

Current flow in the app:

1. Agent clicks **Simulate Call End** in the Agent Home UI.
2. Frontend calls `POST /api/calls/simulate`.
3. Backend chooses a sample transcript, runs transcript analysis, creates a call row, and creates analysis artifacts.
4. Frontend stores call/tip/notification state for the agent experience.

This is useful as a demo/development harness, but it is not telephony-native.

### 1.2 Existing backend capabilities we can reuse

The backend already supports the key persistence patterns needed for Twilio ingestion:

- create a call record with metadata,
- include transcript at create-time when available,
- update transcript later when transcript arrival is delayed.

That means we can support asynchronous transcript lifecycles (partial/final delivery) without redefining the core calls schema.

### 1.3 Existing architecture principle we should preserve

Ingestion should be separated from analysis:

- ingestion receives call events/transcript payloads,
- ingestion normalizes/persists call data,
- downstream analytics pipeline runs after transcript readiness,
- UI consumes resulting metrics/alerts/coaching artifacts.

---

## 2) Target Twilio Routing + Transcription Model

### 2.1 High-level routing path

Target call path:

1. Caller dials a Twilio phone number.
2. Twilio routes call into the configured workflow (number/queue/agent strategy).
3. Twilio emits lifecycle and transcription events to backend webhook endpoints.
4. Backend maps Twilio identifiers to internal entities (`team_id`, `agent_id`, optional queue/contact metadata).
5. Backend persists/updates call record and triggers analytics once transcript is ready.
6. Dashboard/agent views reflect processed call outcomes.

### 2.2 Preferred first approach: Twilio transcription events (Option A)

For speed and demo realism, first iteration should use Twilio-managed transcription events:

- Twilio handles telephony orchestration.
- Twilio sends transcript event payloads to backend.
- Backend normalizes payloads into internal call contract.
- Existing analysis pipeline remains the same.

This is the shortest path to replacing manual simulation with a real inbound-call story.

### 2.3 Later approach: Media Streams (Option B)

If/when we need more control:

- use Twilio Media Streams (audio over WebSocket),
- handle or outsource STT ourselves,
- preserve same downstream ingestion contract.

This path increases flexibility but is heavier in implementation and operations.

---

## 3) Canonical Ingestion Contract (Unchanged)

Regardless of source (simulation, Twilio events, media stream), ingestion should converge on:

- `call_id` (or deterministic external correlation key before internal ID exists)
- `agent_id`
- `team_id`
- `started_at`
- `duration_seconds`
- `transcript` (partial or final)
- optional metadata (`recording_url`, `customer_id`, `queue`, `channel`, `contact_id`, etc.)

And standardized state transitions:

1. `received`
2. `transcribing` (if applicable)
3. `ready_for_analysis`
4. `analyzing`
5. `completed` or `failed`

---

## 4) Routing and Identity Mapping Decisions

To support real call routing, we should define explicit mapping rules before implementation:

### 4.1 Twilio call identity

- Primary external key: Twilio Call SID.
- Requirement: idempotent ingestion so duplicate event delivery does not create duplicate calls.

### 4.2 Team and agent assignment strategy

Possible mapping hierarchy (recommended order):

1. explicit agent mapping from known Twilio worker/task attributes,
2. queue/number mapping to team,
3. fallback ownership rules for unassigned calls.

### 4.3 Transfer/escalation behavior

Define how to represent multi-agent calls:

- single call record with transfer metadata, or
- parent call with child segments.

Choose one model up front to avoid analytics/reporting inconsistencies.

---

## 5) Event Handling Model for Twilio Transcription

### 5.1 Event categories to account for

- call lifecycle events (initiated/ringing/answered/completed),
- transcript partial updates,
- transcript final/completion signal,
- recording availability (if used).

### 5.2 Processing rules (recommended)

- Persist lifecycle metadata as soon as call is known.
- Accept partial transcript updates but do not finalize analytics yet.
- Trigger analysis on transcript final event (or completion timeout fallback).
- Persist all failures with retryable state where applicable.

### 5.3 Reliability and security requirements

- Verify Twilio webhook signatures.
- Add idempotency checks per event/call key.
- Use bounded retries and dead-letter visibility for failed processing.
- Separate ingestion failures from analysis failures for observability.

---

## 6) Proposed Rollout Sequence

### Phase 0 — Keep current simulation harness

Keep `POST /api/calls/simulate` available for non-telephony testing while Twilio path matures.

### Phase 1 — Introduce ingestion service boundary

Create a shared internal ingestion service callable by both:

- simulate endpoint,
- Twilio event handlers.

### Phase 2 — Add Twilio webhook/event ingestion

Implement webhook endpoints and normalization/mapping/idempotency.

### Phase 3 — Enable analytics trigger from transcript readiness

Ensure transcript completion transitions call into existing analysis flow.

### Phase 4 — UI and operational hardening

- surface ingestion/analysis status,
- add runbooks/alerts for delayed or failed transcript processing,
- gradually de-emphasize manual simulation in production-like demos.

---

## 7) Open Questions (To Resolve Before Build)

1. Which Twilio product surface is primary for routing (plain Programmable Voice, TaskRouter/Flex, or hybrid)?
2. What is the authoritative source for agent assignment when routing and identity disagree?
3. Do we need near-real-time sentiment updates from partial transcripts, or final-only analysis for MVP?
4. What retention policy applies to raw transcript and recording URLs?
5. How should transferred calls appear in supervisor metrics and per-agent scorecards?

---

## 8) Summary

- Current simulation path remains useful as a development harness.
- Twilio transcription event ingestion is the recommended first real-ingestion step.
- Media Streams remains a follow-on option for deeper control.
- The core rule: preserve a single ingestion contract so downstream analytics remains stable while ingestion evolves.
