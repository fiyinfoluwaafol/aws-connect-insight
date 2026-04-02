# Call Ingestion Approaches

## Purpose

This document captures how we are currently simulating completed calls for the demo and outlines stronger call-ingestion options that can be layered in after the core call analytics pipeline is working.

The immediate goal is not to perfect ingestion. The immediate goal is to make sure we can reliably hand a completed call transcript plus its metadata into the backend pipeline that generates summaries, coaching, alerts, and search indexes. Once that contract is stable, we can change how calls arrive without changing downstream analytics logic.

## Core Principle

We should treat ingestion as a separate concern from analysis.

Regardless of where a call comes from, the pipeline should expect the same minimum input:

- `call_id`
- `agent_id`
- `team_id`
- `started_at`
- `duration_seconds`
- `transcript`
- optional metadata such as `recording_url`, `customer_id`, `queue`, `channel`, `contact_id`

In practice, the ingestion layer should do one job: create or update the `calls` record and mark it ready for analysis. Everything after that should be the same pipeline.

## Current Method

### 1. Frontend-triggered simulated call end

This is the current approach used in the app today.

Flow:

1. An agent clicks `Simulate Call End` in the frontend.
2. The frontend picks an existing mock call from that agent's history.
3. The app uses transcript-backed mock data that already exists in the database or seeded dataset.
4. The app treats that call as if it just ended and generates post-call coaching from it.

Current implementation notes:

- The button lives in the agent experience and is currently implemented in [frontend/src/pages/agent/Home.tsx](../../frontend/src/pages/agent/Home.tsx).
- The mock service has a matching simulation path in [frontend/src/lib/mock-service.ts](../../frontend/src/lib/mock-service.ts).
- On the backend side, calls can already be created without a transcript and later updated with one via [backend/database/calls.py](../../backend/database/calls.py).

Why we have it:

- Fastest way to demo the post-call experience.
- No dependency on live telephony infrastructure.
- Lets us validate downstream analytics and coaching UX before solving real ingestion.

Limitations:

- It does not look like a real system event; it looks like a manual demo trigger.
- The frontend is deciding when a call "ended," which is the wrong long-term responsibility.
- It does not model delayed transcript arrival, retries, or partial failures.
- It does not naturally scale to supervisor workflows, background processing, or near-real-time ingestion.

Recommendation:

- Keep this method while the core analytics pipeline is being built.
- Reframe it internally as a development harness, not the long-term ingestion model.

## Better-Looking Approaches To Add Later

These are the stronger future options we should propose once the core analytics pipeline is stable. Both replace the manual frontend trigger with a real call flow and make the demo feel much more credible.

### 2. Option A: Twilio call -> Twilio real-time transcription -> backend -> analytics pipeline -> dashboard

This is the fastest and strongest option if the main priority is a clean, convincing demo.

How it works:

1. A user calls a Twilio number.
2. Twilio starts live transcription using `<Start><Transcription>`.
3. Twilio sends transcription events, partial transcript output, or completed transcript output to our backend.
4. The backend normalizes the transcript and call metadata into the ingestion contract.
5. The analytics pipeline extracts sentiment, summary, issue tags, flags, etc.
6. Results are stored and surfaced in the dashboard.

Why this is strong:

- It feels like a real call workflow, not a UI demo shortcut.
- Twilio handles the telephony layer and much of the transcription orchestration.
- It gets us to "someone placed a call and analytics showed up in the app" with relatively low implementation weight.
- It is the cleanest path if demo quality matters most.

Why it looks better than the current method:

- No agent-facing fake button.
- The system reacts to an actual phone call.
- The analytics story becomes easy to explain end to end.

Tradeoffs:

- We are coupled to Twilio's transcription features and event model.
- We get less control over raw audio handling than a lower-level streaming approach.
- We still need to decide how to handle partial transcripts versus final transcript readiness.

Recommendation:

- This should be the preferred post-pipeline ingestion option for demo readiness.

### 3. Option B: Twilio call -> Media Streams WebSocket -> backend -> transcription layer -> analytics pipeline

This is the more flexible option, but it is slightly harder to build.

How it works:

1. A user calls a Twilio number.
2. Twilio streams raw call audio to our backend over Media Streams WebSockets.
3. Our backend receives the audio stream and either:
   transcribes it directly, or
   forwards it to a speech-to-text layer.
4. Once transcript data is available, the backend passes the normalized call into the analytics pipeline.
5. The pipeline produces sentiment, summary, issue tags, flags, and any other downstream outputs.

Why this is strong:

- We control the audio handling path.
- The architecture is more provider-agnostic.
- It gives us flexibility to swap transcription providers or add custom speech-processing logic later.
- It is more technically impressive from an architecture standpoint.

Why it may be worth the extra effort:

- Better long-term extensibility.
- Easier to evolve into a more production-style ingestion pipeline.
- Gives us more control over timing, buffering, retries, and transcript quality strategies.

Tradeoffs:

- More build-heavy than Option A.
- We have to own more of the streaming and transcription complexity.
- Longer path to a polished demo compared with using Twilio transcription directly.

Recommendation:

- This is the better architectural choice if flexibility matters more than speed, but it should not be the first move if the main objective is getting a strong demo in place quickly.

## Recommended Rollout

### Near term

Keep the current frontend-triggered simulation while building and validating:

- transcript normalization
- call record creation/update
- analysis job orchestration
- status tracking
- downstream UI refresh behavior

### Next step after pipeline stability

Implement Option A first:

- Twilio call
- Twilio transcription
- backend ingestion
- analytics pipeline
- dashboard update

This gives us:

- the fastest path to a believable live demo
- a much cleaner story than the manual button
- a real inbound call event that can feed the same analytics contract

### Later

If we need more flexibility or want to reduce dependence on Twilio-managed transcription, move to Option B.

### Long term

If the product direction requires it, we can later revisit AWS Connect or another provider-specific integration. That should be a separate decision from getting the analytics pipeline working and demoable.

## Suggested Architecture Boundary

To avoid rework, all ingestion methods should converge on the same backend entry point, conceptually something like:

1. `ingest_call(metadata, transcript_or_recording_reference)`
2. persist call
3. mark ingestion state
4. enqueue analysis
5. publish processing status back to the app

If we do that, the current button, Option A, and Option B can all reuse the same backend path.

## Recommendation Summary

For now, keep the current manual simulation because it is helping us validate the analytics experience.

After the core pipeline works, the recommended next step is Option A: Twilio call plus Twilio real-time transcription feeding the backend and dashboard. It is the fastest path to a strong demo and the cleanest story to tell.

Option B is the better choice if we want more control and a more provider-agnostic architecture, but it is heavier to build and should be treated as the more flexible follow-on path rather than the first implementation target.
