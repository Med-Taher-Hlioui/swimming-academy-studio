# Architecture — functional V0

Swimming Academy Studio is a fictional demonstration for swimming academy owners in Tunisia. In-memory demo data is not secure or suitable for real personal information. Do not enter real children's details. There is no authentication or authorization; noindex metadata is not an access boundary.

## Modules

- `src/app`: App Router pages and the shared root layout. Server-rendered route wrappers compose interactive feature components.
- `src/components`: responsive shell and navigation, reusable cards, badges, headings, empty states and accessible tables.
- `src/config/academy.ts`: application-wide academy name, accent color, tagline, locale and time zone. The Settings form remains a temporary branding preview.
- `src/features/academy/models.ts`: domain entities and explicit `AcademyRepository` / `AcademyService` interfaces. Coaches are separate entities; attendance references sessions.
- `src/features/academy/mock-repository.ts`: anonymous fictional seed factory and an asynchronous in-memory persistence adapter.
- `src/features/academy/rules.ts`: group validation, session date validation and attendance rules.
- `src/features/academy/service.ts`: validated mutations, serialized read-modify-write operations and dashboard derivation.
- `src/features/academy/demo-provider.tsx`: one repository/service instance per mounted workspace; shared client snapshot, pending state, errors, success feedback and reset.
- Feature components under `swimmers`, `groups`, `attendance`, `registrations`, `overview`, `settings`: user interactions and presentation, without direct repository writes.

## Data flow and lifetime

The root layout mounts the demo provider around the existing shell. Each mounted provider creates an isolated memory repository and service; there is no mutable server-global repository. Route wrappers remain Server Components while interactive feature components consume the shared context. No fetch requests or remote services are used.

A UI action calls the typed service through the provider. The service reads a cloned repository snapshot, validates a change, saves an updated snapshot and returns recalculated dashboard data. The provider publishes that result to every feature, so navigation to Overview, Swimmers or Groups shows the latest values. Failed validation leaves both repository and shared UI data unchanged. Service writes are queued; the UI also disables overlapping actions.

Persistence lasts across Next.js client navigation within the mounted workspace. Reloading, opening a new tab or selecting **Reset demo data** restores the seed. Reset remounts feature forms to clear stale selections. Data is not written to localStorage, cookies, files or a server. Memory is a demo adapter, not secure storage.

## Domain rules

### Groups and coaches

Group names must be unique ignoring case and contain 1–60 characters after trimming. Coaches must reference a seeded demo coach. Capacity must be an integer from 1 to 50 and cannot be lower than the submitted roster size. Rosters cannot contain duplicates or unknown swimmers, and every selected swimmer must match the group level.

Saving a group allocates selected swimmers and transfers them from previous groups. Deselected swimmers previously in the edited group become unassigned. Occupancy is derived from current swimmer allocations, never a separate editable counter. A group can be empty. Existing sessions keep their historical rosters when current allocations change.

### Sessions and attendance

A session references a group, a valid calendar date and a snapshot of its current swimmer IDs. There is one session per group per date; scheduling multiple sessions per day is outside V0. Empty groups cannot create sessions.

Only swimmers on the selected session roster can be marked. There is at most one mark per swimmer/session: selecting Present or Absent replaces the existing mark; Unmarked removes it. Marks for other sessions remain unchanged. Unmarked does not mean absent.

### Registration enquiries

The form accepts only a demo applicant number (1–9999), swimming level and a fictional-data confirmation. It generates an alias; it does not ask for names, ages, contact information or free-text notes. Duplicate aliases are rejected, including previously reviewed enquiries. Validation exists both in the form and service.

Reviewing an enquiry updates its status and dashboard count, but does not enroll a swimmer, reserve capacity or send a message. New enquiry dates use the current UTC calendar day; seed dates are fixed fictional examples.

### Dashboard

Counts come from the shared snapshot: swimmers, groups, distinct group levels, sessions, pending enquiries and available group places. Attendance percentage is present records divided by all marked records; it is null when there are no marks. It is not a percentage of all enrolled swimmers. Group occupancy and available capacity use current swimmer allocations.

## UI and styling

TypeScript strict mode remains enabled. Tailwind CSS 4 utilities and global CSS retain the deep navy, aqua and white identity. Desktop navigation becomes an expandable mobile menu. Tables scroll within their containers. Fields have labels, errors and success feedback use live regions, and native validation complements service validation. System fonts avoid a remote dependency.

## What remains simulated

There is no durable storage, multi-tab synchronization, login, authorization, payment, notification, email, external integration or AI connection. There is no automatic schedule recurrence, coach availability/conflict checking, group deletion, full swimmer CRUD, audit log or automatic enquiry-to-enrollment flow. Only seeded swimmers and coaches can be allocated. Groups and schedules are fictional editable labels. Academy locale is configuration metadata; interface translation and locale-aware formatting are not implemented. Content Studio has fixed French, Tunisian Arabic and English templates; it does not translate the description.

SHARK AI now provides a template-based Content Studio (Demo Generator, not real AI). See [CONTENT_STUDIO.md](CONTENT_STUDIO.md) for its separate provider/service/repository design and future cloud integration steps. Settings changes only a branding preview; code configuration controls actual workspace branding. The current repository reads/writes whole snapshots, appropriate only for this small single-user demo.

## Future Supabase boundary — not implemented

A future repository can implement the same typed persistence boundary, mapping database rows to domain objects. It will require academy-scoped entities, authenticated memberships, row-level authorization, validated server mutations, concurrency protection and transaction-safe capacity checks before holding personal data. Split whole-snapshot access into feature-specific queries as data grows; do not directly expose privileged database credentials to client components.

No Supabase SDK, project, migrations, credentials or connection is included. Verify current official guidance before implementing that future stage.

## Validation

- `npm test`: compiles the isolated TypeScript unit suite and runs Node's built-in test runner.
- `npm run lint`: ESLint with Next.js/TypeScript rules.
- `npm run typecheck`: strict TypeScript check.
- `npm run build`: production compilation and route generation.

See [DEMO.md](DEMO.md) for a manual walkthrough and limitations.

## Owner demonstration presentation layer

The shared shell now includes a prominent Demo Mode banner, a confirmation before resetting, and an optional six-step owner walkthrough. Reset is the existing provider remount boundary: it clears academy edits, Content Studio memory, form state and guide progress together. It does not contact external services.

The walkthrough lives in `src/features/demo`. Its provider captures a baseline when started. Steps require the matching route and observable evidence: opening a seeded group editor, changing attendance, adding an enquiry, generating and saving new content, then scheduling an approved draft. The guide never changes academy records on behalf of the presenter. Restarting the guide captures a new baseline without resetting data.

The mobile menu remounts closed on route changes and supports Escape. Controls have 44px minimum heights; form text is 16px to reduce mobile zoom. Fieldsets and cards allow shrinking; wide tables have keyboard-focusable scroll regions and a mobile hint. Reduced-motion preferences are respected. Global page loading, route error recovery and not-found screens are included. Local action feedback is associated with its originating academy route.

Settings now shows a live preview with an explicit reset, without a redundant save-like action. It remains a demonstration of branding rather than a persistent configuration editor. New service-level walkthrough tests cover the presentation sequence; browser rendering and operating-system clipboard behavior are separate checks.
