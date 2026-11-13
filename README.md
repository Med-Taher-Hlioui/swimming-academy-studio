# Shark Aquatics Academy OS

A Next.js application containing the public Shark Aquatics website, a fictional owner demo, and separate authenticated Admin and Parent workspaces. The current development branch is `preview/academy-dev` in `Med-Taher-Hlioui/swimming-academy-studio`.

## Routes and data boundaries

| Area | Routes | Behavior |
| --- | --- | --- |
| Public website | `/`, `/inscription` | Academy information, swimming programs, team, directions, registration instructions and WhatsApp trial requests. Requests open WhatsApp for the visitor to send. |
| Fictional demo | `/dashboard`, `/swimmers`, `/groups`, `/attendance`, `/registrations`, `/shark-ai`, `/settings` | Search, group capacity, attendance, simulated enquiries, guided tour and template-based Content Studio. DEMO MODE remains visible. |
| Admin | `/admin/login`, `/admin/dashboard`, `/admin/swimmers`, `/admin/subscriptions`, `/admin/groups`, `/admin/attendance`, `/admin/registrations`, `/admin/invitations` | Verified sign-in and active Admin membership for the server-configured academy. Includes guardian contacts, document receipt statuses, monthly subscription observations, review tools and verified Parent invitations. |
| Parent | `/parent/login`, `/parent/invite`, `/parent`, `/parent/children/[id]` | Verified sign-in, active Parent membership and an Admin-verified guardian link. Shows authorized children, attendance and published notes, subscription and document information. |
| Parent Auth callback | `/parent/auth/callback` | Scoped PKCE code exchange with fixed internal destinations. Successful external email/SSO delivery remains to be exercised. |

Admin and Parent use Supabase Auth, server-side role checks, tenant isolation, controlled database operations and separate HttpOnly session cookies. Protected responses use private/no-store caching. Parent data is limited by verified relationships, publication rules and approved history dates. Guardian contact records alone grant no access.

The fictional demo uses in-memory records independent of the authenticated workspaces. Reloading starts a fresh demo. **Never enter real children's details into the demo. Its storage is unsuitable for real personal information.** SHARK AI is a deterministic Demo Generator. Captions and calendar entries remain drafts until the owner acts outside the application.

## Local setup

Use Node.js 24 LTS and npm. From this repository run the following commands.

```sh
npm ci
npm run dev
```

Open `http://localhost:3000` for the website or `/dashboard` for the fictional demo. These areas work without database configuration. Admin and Parent access requires separate local opt-in configuration and pre-provisioned verified synthetic identities.

To run the production build locally, use the default Turbopack build.

```sh
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

### Local authenticated workspaces

Use a disposable local Supabase PostgreSQL 17 stack with the seven versioned migrations under `supabase/migrations`. No real workbook or personal records are needed. The designated hosted development project is `academy-os-dev` (`dzepxtynubzhwmcezvvp`). Local commands must target the local stack.

```sh
supabase --version
supabase start
supabase db reset --no-seed
supabase test db
```

The migration workflow was prepared with Supabase CLI 3.1.0. Verify command help when using another version. Reset applies only to the disposable local database.

Configure local values in an ignored environment file. The following table lists names only.

| Variable | Local purpose |
| --- | --- |
| `SHARK_LOCAL_ADMIN` | Set to `1` to opt in to Admin access. |
| `SHARK_LOCAL_PARENT` | Set to `1` to opt in to Parent access. |
| `SHARK_LOCAL_SUPABASE_URL` | Loopback API URL, `http://127.0.0.1:<local-port>`. |
| `SHARK_LOCAL_SUPABASE_PUBLISHABLE_KEY` | Publishable key from the disposable local stack. |
| `SHARK_LOCAL_ACADEMY_ID` | Synthetic academy UUID required for Admin access. |

Run the application bound to `127.0.0.1`. Provision verified synthetic accounts and authorized memberships through the reviewed local fixtures or operator workflow. The application has no public account-creation flow. Fixture/operator credentials belong only to their provisioning process. Keep them outside the application environment and Git.

## Guided owner demo

Open `/dashboard` and choose **Start guided demo**.

1. Review dashboard statistics derived from fictional records.
2. Open and edit a training group, checking coach assignment and capacity.
3. Record attendance for a selected session.
4. Submit a fictional registration enquiry.
5. Generate a caption and save a draft in SHARK AI.
6. Approve the draft and add it to the weekly calendar.

Choose **Reset demo data**, then **Reset everything** to restore academy fixtures, clear content drafts and reset the guide. **Keep my changes** cancels. Client navigation preserves demo changes within the tab. Caption copying uses the clipboard when permitted and provides manual-copy feedback otherwise.

## Testing

```sh
npm test
python -B -m unittest discover -s scripts/import
npm run lint
npm run typecheck
npm run build
node scripts/preview-security-check.mjs
```

Application tests cover academy rules, server authorization boundaries, Parent visibility helpers, Preview configuration, public requests, Content Studio and the guided tour. Importer tests use synthetic inputs. Database security tests run separately with `supabase test db` against the disposable local stack.

For the public/demo browser regression suite, keep the production server running on `127.0.0.1:3100`, then run `node scripts/browser-smoke.mjs`. It uses installed Chrome or Edge on Windows and writes artifacts to ignored `.browser-test/`. `SMOKE_ORIGIN` can select a different local server. Authenticated Admin/Parent browser harnesses remain local review tools and require approved synthetic fixtures.

### Turbopack build recovery

The Phase 3.6 review reproduced a CSS-loader worker startup failure against existing generated `.next` output. Preserving that output under ignored `.local-dev/` and building from a fresh `.next` directory restored the default Turbopack build. This recovery requires no application dependency or build-command change.

If the same worker failure recurs, stop this repository's dev/start processes, verify that `.next` resolves inside this repository, and move it to a new ignored `.local-dev/` backup directory. Then rerun `npm run build` and repeat the build with its fresh cache. Preserve source and environment files. Record a new failure if a clean build also fails. A Webpack fallback alone does not verify the default build path.

## Separate protected Vercel Preview

The proposed target is a new `swimming-academy-studio-preview` project in the owner's Vercel team, connected only to approved source on `preview/academy-dev` and the dedicated Supabase development project. It awaits owner approval and creation. No working Preview URL has been established.

The existing production project is `swimming-academy-studio`, and the local `.vercel` link points to it. Every future Preview operation must explicitly select the new project ID and team. Configure Vercel Authentication and reviewer access before enabling Git deployments. Verify that the new ID differs from production, retain the existing production domain, and add a project-level build gate allowing only the exact branch in the standard Preview environment. `vercel.json` provides a branch allowlist but cannot establish the project's protection or environment settings.

Set only these development values in the new project's branch-scoped Preview environment.

- `SHARK_PREVIEW_ENABLED`
- `SHARK_PREVIEW_SUPABASE_URL`
- `SHARK_PREVIEW_SUPABASE_PUBLISHABLE_KEY`
- `SHARK_PREVIEW_ACADEMY_ID`

The app also checks the platform-provided `VERCEL`, `VERCEL_ENV`, `VERCEL_TARGET_ENV` and `VERCEL_GIT_COMMIT_REF`. Hosted workspaces activate only for the exact Preview branch, development URL and valid configuration. Preview cookies are Secure and role-scoped. Application deployment uses a publishable key and verified user sessions. Privileged keys and database passwords belong outside the application configuration.

The GitHub workflow validates source without deploying. The rollout requires separate approval of the exact publication inventory, protected project creation, database migrations, development configuration and synthetic accounts, commit/push, and first deployment. Native Git deployment activation must follow those approvals. Cloud authentication, tenant isolation and both access layers require acceptance tests before sharing the protected URL.

## Current limitations

- Admin group management requires an existing eligible primary coach. Coach-assignment editing and a Coach workspace remain future work.
- Parent activity has bounded result limits. Historical pagination, real account provisioning and successful external email/SSO delivery remain pending.
- Monthly payment statuses are recorded observations. The app has no payment processing, transaction ledger, collection totals or inferred balances.
- Document handling records receipt statuses. It provides no file uploads.
- Import tools support local dry-run/review workflows. Real workbook apply remains a separate approved operation.
- The public trial helper collects audience and estimated swimming level and opens an encoded WhatsApp request. Booking confirmation and online scheduling are outside this workflow.
- External AI, automatic social publishing and notifications remain pending. Settings in the fictional demo is a branding playground.

## Content, branding and publication

Public content is configured in `src/config/public-site.ts`, media references in `src/config/public-media-manifest.json`, and demo branding in `src/config/academy.ts`. Public layout/components remain separate from Admin, Parent and demo providers. Public preview metadata remains noindex, and workspace pages remain noindex/nofollow.

The development Preview uses labeled aquatic placeholders and pending portraits. The original logo, photos, decorative artwork and videos are preserved in ignored local storage and excluded from Git and deployment uploads. Video playback controls are omitted. Restore original media only after its intended publication rights are confirmed, preserving the official logo's proportions. Website-use permission does not establish public GitHub redistribution permission.

Keep private workbooks, environment files, original media, local fixture state and review artifacts excluded from Git and deployments. `.env.example` contains placeholders only. The public source commit must use the reviewed per-file inventory.


The operator-only synthetic demonstration seed is `scripts/preview/seed.sql`. It requires three distinct verified synthetic `example.test` identities passed as psql variables `admin_uid`, `parent_uid` and `other_parent_uid`. It creates eight swimmers, three coached groups, eight subscriptions, June–November 2026 status observations, sessions and verified guardian links in a transaction. All people, birth dates, amounts and records are fictional. Run only against an approved development target after the seven migrations. The seed refuses to overwrite an existing Preview academy. Auth accounts must be provisioned separately after approval.
