# SHARK AI V0 — Content Studio

## What works

The SHARK AI route is a Content Studio labeled **Demo Generator** and **Templates, not real AI**. It makes no external AI calls and supports no photos, uploads or automatic publishing.

1. Choose Instagram, Facebook or TikTok.
2. Choose awareness, education, parent trust or registrations.
3. Describe a fictional lesson/event in 10–500 characters. Use the example button if needed.
4. Choose French, Tunisian Arabic or English.
5. Generate exactly three examples, each with a hook, caption and call to action.
6. Save an example as a draft, then edit and save its three text fields.
7. Review the saved text and select **Approve draft**.
8. Choose a calendar date and add the approved draft to the weekly content calendar. The visible week follows that date. Move or remove its calendar entry as needed.

Templates vary by objective, platform and language. The same normalized brief produces the same three text examples; there is no inference, randomness, learning, translation or factual verification. Platform-specific endings provide different prompts/hashtags, not algorithm or performance guarantees.

Tunisian Arabic templates use Arabic script and right-to-left fields. The interface remains English. The description is included verbatim after trimming; it is not translated. Write it in the selected language for consistent copy. All content requires human language and fact review.

**Copy caption** copies the current hook, caption and call to action separated by blank lines. Clipboard permissions depend on the browser. If copying fails, the UI provides selectable text for manual copying. Copying is an explicit local action, never publishing.

## Draft and calendar rules

- Generation does not create drafts automatically. Regenerating replaces the unsaved examples; saved drafts remain.
- Drafts keep their platform, objective, language and original brief.
- Hook: 1–180 characters; caption: 1–2000; CTA: 1–200 after trimming.
- Only approved saved drafts can be scheduled. Unsaved editor changes disable approval/scheduling.
- Changing approved copy returns it to draft status and removes its calendar entry. It must be reviewed again. Saving identical normalized text preserves approval.
- Each draft can occupy one date. Scheduling it again moves its entry rather than duplicating it.
- Removing a calendar entry retains the approved draft.
- The calendar runs Monday–Sunday and stores date-only plans, without time zones or posting times. Multiple drafts can share a day.
- A fixed fictional week (12 October 2026) is the initial calendar view. Adding a draft switches the view to its selected week.

Approval is a manual planning action, not moderation, legal review or proof that claims are true. The app does not invent prices, coach credentials, availability, testimonials or real academy details. The owner's description and edits are unverified input.

## Architecture

The module lives under `src/features/content-studio`, separate from academy management.

- `models.ts`: typed briefs, drafts, provider results, repository and service interfaces.
- `template-provider.ts`: the deterministic provider and localized templates.
- `rules.ts`: validation, combined caption formatting and date-only week helpers.
- `memory-repository.ts`: cloned per-workspace draft snapshots.
- `service.ts`: validated draft mutations, approval/calendar invariants and serialized writes.
- `composition.ts`: injection point selecting the repository and generation provider.
- `content-provider.tsx`: shared browser state, pending actions, feedback and generation results.
- UI components: generation form, example cards, draft editor cards, copy controls and weekly calendar.

The root layout mounts ContentStudioProvider inside the existing resettable DemoProvider. Drafts, generated examples and calendar selection survive client navigation. The existing **Reset demo data** action remounts the content provider, clearing its repository. Reload and a new tab also start empty. There is no localStorage, cookie, database or server write. Unsaved draft editor text is local to its component and can be discarded or lost when navigating away.

**In-memory demo data is not secure or suitable for real personal information. Never enter real children's details or identifiable event descriptions.** The feature deliberately has no media upload.

## Provider boundary and next cloud integration steps

The UI uses ContentStudioService; it does not import a cloud SDK. ContentGenerationProvider exposes provider metadata and:

```ts
generate(brief: ContentBrief): Promise<[ContentCopy, ContentCopy, ContentCopy]>
```

A future cloud adapter can satisfy that contract. Provider label/mode already control the displayed disclosure. The current composition injects only templates; the test-only replacement provider exercises the same interface without any network request.

Before connecting a cloud model:

1. Add a server-only generation endpoint with authentication, academy authorization and validated inputs. Keep all provider credentials on the server. Add request-size limits and rate/cost limits.
2. Implement a browser adapter conforming to ContentGenerationProvider that calls that endpoint. Replace the provider in `composition.ts`; forms, editors and calendar continue using the same service contract. Never import a credential-bearing SDK into a client bundle.
3. On the server, request structured output with exactly three hook/caption/CTA objects. Validate the schema and length limits before returning it. Handle malformed output, timeouts, cancellation, throttling and retries with clear errors; do not silently pass off fallback templates as model output.
4. Decide and disclose the actual model, data handling/retention and provider mode. Add data minimization and personal-information detection before sending user input. Do not send academy rosters or children's details.
5. Evaluate French, English and Tunisian Arabic quality with native reviewers. Test factual accuracy, unsupported academy claims, prompt injection, inappropriate advice and accidental personal information. Decide whether translation is supported and state that explicitly.
6. Retain manual editing, explicit approval and invalidation after edits. Keep automatic publishing out of this module. If durable multi-user storage is introduced later, enforce permissions, revisions, transactions and an audit trail for approval/calendar changes.
7. Record provider/model/template version provenance and operational metrics on the server without logging sensitive descriptions. Review the chosen provider's current official documentation at implementation time.

No provider account, SDK, environment variable, API key, cloud endpoint or publishing integration has been configured in V0.

## Verification

`npm test` includes all existing academy tests plus content tests covering all 36 option combinations, deterministic output, validation, provider substitution/failure, saving/editing, approval gating, approval invalidation, calendar moves/removal, week boundaries, caption formatting, concurrent saves and repository isolation.

Run `npm run lint`, `npm run typecheck` and `npm run build` as well. Clipboard permissions and native browser behavior need browser-level verification; the unit suite checks caption text, not the operating-system clipboard.

Manual smoke test: generate in each language, save/edit a draft, try scheduling it before approval, approve and schedule it, navigate away/back, edit approved text and verify its calendar entry disappears, then reload to verify the memory reset.
