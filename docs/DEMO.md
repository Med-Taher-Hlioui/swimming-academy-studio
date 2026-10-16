# Functional V0 walkthrough

**Fictional data only. The memory adapter is not secure or suitable for real personal information. Never enter real children's information.**

## What works

1. **Swimmers:** search the six seeded aliases; combine with a level filter. Clear filters from the no-results state. Group assignments reflect group edits.
2. **Groups:** create a fictional group, choose a seeded demo coach, set an integer capacity and a sample schedule. Allocate matching-level swimmers, including transfers from other groups. Edit any group. A capacity lower than the selected roster is rejected without saving.
3. **Attendance:** select a seeded session, mark Present/Absent, or return a mark to Unmarked. Create a new session using a group and date. Session creation snapshots the current group roster. Existing session rosters survive later group transfers.
4. **Registrations:** choose a new demo applicant number (for example 3), level and fictional-data confirmation. Submit the generated alias to the enquiry list. Duplicate applicant numbers are rejected. Mark the enquiry reviewed.
5. **Overview:** attendance percentage, pending enquiry count, group count, session count, available places and roster occupancy derive from the same repository snapshot.
6. **Reset:** use the warning banner's reset action to restore the original records and clear feature forms. Reload has the same effect.

## Try the rules

- Edit Little Waves to capacity 1 while its two swimmers are selected: expect an error and unchanged group data.
- Set its capacity to 2: expect success with zero available places.
- Create a second Beginner group with Demo Swimmer 01 and capacity 1. The swimmer transfers, but the original Little Waves session still contains that swimmer.
- Change Demo Swimmer 02 from Absent to Present in the 12 October Little Waves session. Overview changes from 75% to 100%. Choose Unmarked to remove the mark entirely.
- Create another session for that group/date: expect a duplicate-session error.
- Submit Demo Applicant 03: pending count increases. Review it: pending count decreases, and swimmer count stays unchanged.
- Navigate among pages: edits remain. Reload or open another tab: original fixtures return.

## Simulated behavior

All changes live in one mounted browser workspace's memory. They are not saved to disk, localStorage or a backend, and are not shared with other users or tabs. In-memory data is still inspectable and editable by the browser user; it is not a security boundary.

There is no real enrollment, identity checking, coach calendar, recurring session generation, contact collection, message sending, billing or AI. Free-text group labels and schedules are demo inputs only. Settings branding is a temporary preview. SHARK AI provides a working Content Studio with deterministic templates, editable drafts, caption copying and a manual weekly calendar. See [CONTENT_STUDIO.md](CONTENT_STUDIO.md) for its walkthrough.

## Automated checks

Run `npm test`, `npm run lint`, `npm run typecheck` and optionally `npm run build`.

The unit suite exercises attendance isolation, idempotent updates, unmarking, invalid roster access, invalid session dates, capacity boundaries, over-allocation, duplicate roster entries, swimmer transfers, historical rosters, queued updates, repository isolation and enquiry validation/dashboard consistency. It uses the real service and memory repository; no external test service is involved.

## Guided presenter mode

Select **Start guided demo** in the shared workspace panel. Follow the six steps in the README. Continue is enabled by actual demo actions, not by clicking a checklist: dashboard view, group opened, attendance changed, enquiry added, new caption generated and saved, and an approved draft placed on the calendar. Previous/Exit remain available. Guide progress is local to the mounted workspace and is cleared by reset.

The Demo Mode banner includes **Reset demo data**, followed by **Reset everything** or **Keep my changes**. Reset restores all original academy fixtures and empties the content calendar/draft collection. Starting the guide again without a reset uses the current records as a new baseline, so select an unused applicant number and make a new attendance change.

For an owner presentation, run the production build locally. Settings is an immediately updating branding preview only. There are no hidden live integrations, publishing controls or real AI connections.
