# MERCY COGNITION V2 — architecture sketch

This document defines the **next implementation**. It is a design, not a claim that these abilities already run.

## Data flow

```
text conversation (now) / permissioned camera & microphone (later)
               |
         observation event
               |
   event journal & semantic beliefs
               |
    cognition: retrieve -> infer -> check confidence
               |
      goals + curiosity evaluator
               |
  decision: ask / respond / observe / remain silent
               |
   natural language output + speech synthesis
               |
    record result and user corrections
```

## Data records

**Observation:** `{id, occurredAt, source, content, consentContext}` — what Mercy was told or explicitly permitted to observe.

**Belief:** `{subject, relation, object, sourceIds, confidence, updatedAt, status}` — structured knowledge distinguishable from a guess, with supporting evidence and disputes.

**Episode:** `{id, observations, actions, outcome, timestamp}` — memory of the sequence of an interaction, not an invented description of consciousness.

**Question candidate:** `{topic, missingInformation, relevance, expectedValue, priority}` — the reason to ask, not a hard-coded line of dialogue.

**Goal:** `{id, purpose, priority, permittedActions, status}` — bounded goals Mercy may consider while idle.

## V2 baseline acceptance tests

1. User tells Mercy a fact. It remains available after refresh without retraining a neural network.
2. A later correction updates the fact and retains the fact's provenance; old contradictory beliefs are not presented as certain.
3. A meaningful unknown produces at most one relevant question; no questions are asked if confidence is low or the user opts out.
4. The cognitive engine may decide to remain silent and never calls the mic/camera without explicit permission.
5. Saved v1 identity information can be migrated or preserved with a rollback route.
6. UI animation, established voice pitch/rate and stable root website continue working.

## Separation of responsibilities

The cognitive system determines **what matters** and **why**; a small generative language system can express decisions naturally. This does not impose a fixed vocabulary on Mercy. The two modules should exchange explicit structured data, not unverified narratives.

Future model improvements should be assessed against real conversations, memory retrieval, correction, hallucinations and device performance, especially on the iPhone 11.
