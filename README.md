# Swimming Academy Studio V0

A private owner demonstration for swimming academies in Tunisia. **DEMO MODE is always visible. Every person, group and record is fictional. In-memory storage is not secure or suitable for real personal information. Never enter real children's details.**

## Setup

Use Node.js 24 LTS and npm. The unit suite uses Node's built-in test runner; no cloud account, API key, environment file or database is needed.

```sh
npm install
npm run dev
```

Open http://localhost:3000. For a presentation, use the production build below to avoid development tooling:

```sh
npm run build
npm run start
```

This serves the app locally; it does not deploy it. Another port can be selected with `npm run start -- --port 3100`.

## Guided owner demonstration

Select **Start guided demo** above the dashboard. The guide stays with you across navigation and enables Continue only after the relevant action. You can exit at any time without losing saved demo changes.

1. **View dashboard:** review six statistics and group occupancy, then Continue.
2. **Open a training group:** select **Open / edit group** on Little Waves. Review Demo Coach A, the two fictional swimmers and capacity of eight. Save an optional change or Cancel, then Continue.
3. **Record attendance:** choose the 12 October Little Waves session. Set Demo Swimmer 02 from Absent to Present. The overall attendance rate becomes 100%. Continue.
4. **Simulate a registration:** enter unused demo applicant number 3, choose a level and confirm fictional data only. Submit the enquiry, then Continue. This creates an enquiry, not an enrolled swimmer.
5. **Generate a caption:** select a platform, objective and language. Choose **Use fictional example**, generate three examples, and **Save as draft** on one. Continue. SHARK AI is labeled **Demo Generator**, using deterministic templates rather than real AI.
6. **Plan the content:** review the draft, optionally edit and Save edits, then **Approve draft**. Choose 14 October 2026 (or another date) and **Add to calendar**. The visible week follows the date. Finish the walkthrough.

No content is automatically published. Caption copying uses the clipboard only when requested, with manual-copy text if browser access is unavailable.

## Reset between demonstrations

Choose **Reset demo data** in the Demo Mode banner, then **Reset everything**. The confirmation explains what will be cleared; **Keep my changes** cancels.

Reset restores seeded academy records and removes content drafts, calendar plans, form state and walkthrough progress in this tab. Reloading or opening a new tab also starts fresh. Client navigation keeps saved changes; unsaved editor fields can be lost when leaving a page. Restart walkthrough only restarts guide progress and captures a new baseline; it does not erase records.

## Testing

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Unit tests cover academy capacity/attendance rules, all 36 content option combinations, draft approval/calendar rules, reset isolation, guided-step gating and a complete service-level owner scenario.

Optional browser smoke test (Windows with Chrome or Edge installed): start the production server on port 3100, then run `node scripts/browser-smoke.mjs`. It uses a separate headless browser profile, checks the six-step flow and all pages at 320px/390px, and writes screenshots under ignored `.browser-test/`. No browser package download is required.

Before presenting, manually check:

- At 320px/390px and desktop widths: navigation, forms and calendar; only tables should scroll horizontally.
- Open/close the mobile Menu, use Escape, and navigate to a page.
- Use Tab/Shift+Tab, the skip link, form labels and the scrollable table regions.
- Walk through all six steps, then reset and confirm attendance returns to 75% and content drafts are empty.
- Try capacity 1 with two selected swimmers, a duplicate applicant number and an empty content brief; expect validation without data loss.
- Approve/schedule a draft, edit its copy, save, and confirm the calendar entry is removed until approved again.
- Open an unknown route for the recovery screen. Clipboard behavior depends on browser permissions.

## Working modules and limitations

Working: dashboard, swimmer search/level filters, group creation/editing, seeded coach assignment, swimmer allocation/capacity, session creation/attendance, fictional enquiries/review, multilingual template generation, draft editing/approval, manual weekly planning and guided demonstration.

Simulated or unavailable: real authentication/authorization, durable storage, multi-user sharing, real enrollment, payments, notifications, cloud AI, media uploads and social publishing. There are no connected external services. Settings is a live branding playground; it does not save application settings.

Route loading and recovery screens support navigation/errors. Service actions disable duplicate submissions and provide status/error feedback. Memory operations normally complete immediately, so loading indicators may be brief.

## Branding and architecture

Edit `src/config/academy.ts` for application-wide name, tagline and accent color.

- [Architecture](docs/ARCHITECTURE.md)
- [Demo walkthrough and rule examples](docs/DEMO.md)
- [Content Studio and future cloud integration](docs/CONTENT_STUDIO.md)

No deployment is authorized by this task; deployment requires separate confirmation.
