# OpenAI Calls & Privacy Review

This document inventories every OpenAI-related path found in the current codebase and reviews them from a worst-case privacy perspective.

Assumption for this review: transaction data, merchant names, raw PDF contents, and budget context should all be treated as sensitive personal data unless proven otherwise.

## 1. System Overview

All live OpenAI traffic goes through a server-side proxy:

- client helper: [`services/openai-proxy.ts`](./services/openai-proxy.ts)
- server endpoint: [`api/openai/chat-completions.ts`](./api/openai/chat-completions.ts)

The client sends a Supabase access token to the proxy. The proxy validates the user, attaches the server-side `OPENAI_API_KEY`, and forwards the request to OpenAI Chat Completions.

What this means:

- the OpenAI key is not exposed to the client
- calls are authenticated against the current Supabase session
- the proxy reduces direct client exposure, but it does not by itself make the processing GDPR-compliant

## 2. Active OpenAI Flows

### 2.1 Bulk transaction categorization

**Trigger**

- background categorization after login in [`app/(tabs)/_layout.tsx`](./app/(tabs)/_layout.tsx)
- manual rerun from Settings in [`app/(tabs)/settings.tsx`](./app/(tabs)/settings.tsx)
- core logic in [`services/categorization.ts`](./services/categorization.ts)

**What it does**

- groups uncategorized transactions
- tries local heuristics and rules first
- sends only unresolved transactions to OpenAI
- writes the result back as auto-categorization and audit data

**Payload sent to OpenAI**

- category list
- transaction list with:
  - `id`
  - `date`
  - `amount`
  - `counterparty`
  - derived `merchant`
  - derived `subject`
  - cleaned `details`

**Why it exists**

- to classify transactions when local rules cannot confidently decide
- to reduce manual work and improve downstream budget and forecast quality

**Output usage**

- result is stored in Supabase as auto-category
- audit entry is inserted
- forecast refresh is requested after the batch

**Storage / caching impact**

- OpenAI decisions are cached in browser `localStorage` for 24 hours
- cache key includes a fingerprint plus category, confidence, reason, model, timestamp, and hit count
- cache is cleared on client state reset / logout path via `clearCategorizationClientState()`

**Privacy impact**

- high, because this flow may send a lot of real transaction context at once
- payment route noise is partially removed, but merchant and detail text still travel to OpenAI
- this is the main OpenAI privacy risk in the app

### 2.2 Single-transaction AI recategorization

**Trigger**

- transaction detail screen action: “Laat AI opnieuw bepalen”
- UI handler in [`app/transaction-detail.tsx`](./app/transaction-detail.tsx)
- service wrapper in [`services/transaction-ai-categorization.ts`](./services/transaction-ai-categorization.ts)
- underlying AI call in [`services/categorization.ts`](./services/categorization.ts)

**What it does**

- asks OpenAI to recategorize one transaction
- uses the prediction to prefill the category draft in the UI
- after that, the user can still decide what to save

**Payload sent to OpenAI**

- one transaction with the same transaction fields used by bulk categorization
- same category list as context

**Why it exists**

- to give a quick second opinion for a single transaction
- useful when the current category feels wrong or uncertain

**Output usage**

- the prediction is shown as a draft suggestion in the category sheet
- when the user saves, the category is written to Supabase via normal transaction update flows

**Storage / caching impact**

- no dedicated persistent OpenAI cache in this wrapper
- the underlying categorization service may still reuse the shared OpenAI decision cache
- forecast refresh is requested after the final transaction update path

**Privacy impact**

- medium to high
- lower volume than bulk categorization, but still sends real transaction details
- privacy risk is mainly from the sensitivity of the transaction text, not from scale

### 2.3 Budget coach and automatic savings target

This is actually two OpenAI-enabled helpers in the budget stack.

#### 2.3.a Automatic savings target

**Trigger**

- budget computation in [`services/budget-plan.ts`](./services/budget-plan.ts)
- AI helper in [`services/budget-coach.ts`](./services/budget-coach.ts)

**What it does**

- picks a realistic savings target inside a deterministic min/max band
- used when budget mode is not `custom`

**Payload sent to OpenAI**

- `monthStart`
- `mode`
- `expectedIncomeMonthly`
- `fixedCostsBudget`
- `subscriptionsBudget`
- `variableBaselineBudget`
- `savingsPotential`
- `deterministicTarget`
- `minimumTarget`
- `maximumTarget`
- `monthProgress`
- `projectedMonthlyNet`
- recent income totals
- recent variable totals
- recent savings capacity totals

**Why it exists**

- to improve the quality of the savings target beyond a fixed heuristic
- especially relevant for `active_savings` and `balanced` modes

**Output usage**

- returns one amount
- the result is folded back into the computed budget plan

**Storage / caching impact**

- in-memory cache only, 15 minutes TTL
- no dedicated persistent OpenAI storage found

**Privacy impact**

- medium
- less directly identifying than full transaction categorization, but still reveals financial behavior and capacity

#### 2.3.b Budget coach report

**Trigger**

- service exists in [`services/budget-coach.ts`](./services/budget-coach.ts)
- current repo snapshot does not show a direct runtime caller

**What it does**

- generates a summary, strengths, risks, and actions from budget plan data

**Payload sent to OpenAI**

- `monthStart`
- `monthProgress`
- mode and adjustment factor
- savings target source
- whether OpenAI was used for savings target
- trend totals
- month-to-date totals
- recommendation rows
- warnings
- recommended savings
- savings potential

**Why it exists**

- to turn budget plan data into readable coaching text

**Output usage**

- returns a structured report object
- if OpenAI fails, the code falls back to the plan’s local `coachReport`

**Storage / caching impact**

- in-memory cache only, 15 minutes TTL
- no persistent OpenAI storage found

**Privacy impact**

- medium
- this is more about behavioral finance context than per-transaction detail, but it is still personal financial data

## 3. Inactive or Currently Unused AI Helper

### Rabobank PDF AI mapper

**File**

- [`services/import/rabobank-pdf-ai-mapper.ts`](./services/import/rabobank-pdf-ai-mapper.ts)

**Current status**

- helper exists
- no live caller found in the current app routes or import screen
- the actual import screen currently uses local parsing only

**What it would send**

- raw PDF text
- deterministic parsed rows

**Why it exists**

- to map tricky Rabobank PDF exports into canonical transaction rows

**Privacy note**

- this is the highest-risk latent helper because raw PDF text can contain a lot of unfiltered bank data
- if this helper becomes active, it should be treated as a separate privacy review item before release

## 4. Worst-Case Privacy Assessment

If we assume worst-case handling of personal data, then the current setup has these characteristics:

### What is good

- OpenAI is called through a server-side proxy, not directly from the client
- the OpenAI API key stays server-side
- the proxy validates the Supabase session first
- the import screen currently avoids OpenAI entirely
- background categorization stops and clears client state on logout/session reset

### What is still risky

- transaction text, merchant names, and amounts can all be personal data
- budget context can reveal spending capacity and financial stress
- AI outputs are persisted in the app’s own data model and audit trail
- categorization cache data is kept on-device in browser storage
- there is no obvious redaction layer before sending OpenAI requests
- there is no visible in-app disclosure or opt-in gate for AI processing in the code reviewed here

### GDPR / compliance position

Based on code alone, we should not claim “GDPR safe” or “fully compliant”.

What the code does support:

- technical access control
- server-side key protection
- scoped business logic

What still needs policy / legal / product coverage:

- lawful basis for AI processing
- data processing agreement and vendor terms
- cross-border transfer assessment
- retention rules for logs, cache, and audit data
- user-facing privacy notice
- minimization and purpose limitation confirmation

## 5. Prioritized Improvement Plan

### P0 - Must do first

1. **Minimize payloads before OpenAI**
   - remove any field that is not necessary for the specific AI task
   - shorten transaction detail text where possible
   - never send raw PDF text to OpenAI unless there is no other viable path
   - priority reason: directly reduces sensitive-data exposure

2. **Add explicit AI disclosure or opt-in**
   - show clear user-facing disclosure on AI-enabled flows
   - especially for bulk categorization and budget coaching
   - priority reason: highest compliance and trust impact

3. **Keep the PDF AI mapper inactive until reviewed**
   - do not wire the latent helper into the live import flow without a privacy review
   - priority reason: raw PDF payloads are the most sensitive latent path

4. **Reduce persistent AI caches**
   - limit or remove `localStorage` persistence for OpenAI categorization decisions if possible
   - if retained, keep TTL short and scope user-specific
   - priority reason: lowers device-side retention risk

### P1 - High value

5. **Document retention and purpose limitation**
   - write down what is stored, for how long, and why
   - include audit entries, cache, and derived data
   - priority reason: necessary for governance and GDPR support

6. **Add a feature flag for all OpenAI usage**
   - allow OpenAI flows to be disabled centrally
   - keep deterministic fallback paths functional
   - priority reason: helps incident response and compliance changes

7. **Separate “advisory” vs “decisioning” language**
   - make it explicit that OpenAI assists but does not make final user decisions
   - priority reason: improves user trust and reduces overclaim risk

8. **Add redaction / normalization helpers**
   - centralize removal of technical noise and obvious non-essential fragments
   - priority reason: reduces payload size and accidental leakage

### P2 - Quality and transparency

9. **Add privacy-contract tests**
   - verify payload shape for each OpenAI call
   - verify no accidental extra fields get added later
   - verify cache clear behavior on logout
   - priority reason: prevents regression

10. **Add non-content observability**
    - log only flow name, status, model, duration, and error class
    - avoid logging full prompts or full AI responses
    - priority reason: makes debugging possible without creating more sensitive logs

11. **Add a shared AI policy helper**
    - centralize payload shaping, redaction, feature flags, and telemetry
    - priority reason: reduces drift between flows

## 6. Verification Notes

Current repo snapshot supports these conclusions:

- active OpenAI call sites are limited to categorization, transaction recategorization, and budget coaching
- the import screen does not currently call OpenAI
- the PDF AI mapper is present but not currently wired into a live user flow
- all OpenAI traffic goes through the same server-side proxy path

## 7. Suggested Next Step

If this document is going to be shared outside engineering, the next best addition would be a short “privacy notice draft” that translates the technical inventory into user-facing language.
