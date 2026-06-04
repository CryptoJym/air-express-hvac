# Air Express New Reward Onboarding Gap Map

Date: 2026-06-02

Mode: existing-repo onboarding pass. This packet adds control-plane docs and
ledgers without reorganizing the production website repo.

## Operating Frame

- Outcome: convert the existing Air Express repo into a New Reward
  onboarding/control hub without disrupting live launch work.
- Owner: James / New Reward.
- Supporting owner: implementation agent.
- Not included: DNS changes, Vercel mutations, ServiceTitan/CRM mutations,
  Cloudflare changes, Turnstile/provider auth changes, public sends, public
  posts, paid signups, or production deploys.
- Next action: document verified current state, missing access, distribution
  lanes, blockers, and the implementation roadmap.
- Proof of done: repo-local onboarding docs, access/channel matrix,
  distribution and roadmap trackers, blockers, and verification notes.
- Communication channel: repo-local docs and thread first.

## Existing Artifacts

Verified in repo:

- `AGENTS.md` exists and marks client operations, marketing, CRM, and
  automations as production-impacting.
- `docs/air-express-launch-runbook.md` exists and documents the intended
  ServiceTitan, DNS, Cloudflare, Vercel, and New Reward worker launch sequence.
- `docs/air-express-tomorrow-checklist.md` exists and documents launch-day DNS,
  Turnstile, redirect, verification, and mail-safety steps.
- `admin/config.yml` configures Decap CMS against `CryptoJym/air-express-hvac`
  with canonical site URL `https://airexpressutah.com`.
- `admin/OAUTH_SETUP.md` documents the self-hosted GitHub OAuth flow on Vercel.
- `scripts/verify-cutover.mjs` and `scripts/verify-email-auth.mjs` provide
  non-mutating launch verification.
- `output/air-express-servicetitan-guide/client-guide.md` records prior
  ServiceTitan lead verification evidence from 2026-04-24.

Missing before this pass:

- Repo entrypoint for current onboarding/control status.
- Agent handoff packet.
- Source evidence map separating repo, live DNS/HTTP, public search, official
  docs, and assumptions.
- Access/channel matrix.
- Distribution ledger.
- Benchmark query list.
- Weekly scorecard.
- Static roadmap/performance tracker.
- Issue-board seed aligned to New Reward P0/P1/P2 lanes.

## Current Live State Deltas

The April runbook and tomorrow checklist are now historical for several launch
facts. Do not delete them; they remain useful as safety docs. The current live
checks on 2026-06-02 show:

- `airexpressutah.com` uses Cloudflare nameservers.
- Apex and `www` resolve to Cloudflare IPs and return HTTP 200.
- `airexpresshvac.net` redirects to `https://airexpressutah.com/`.
- New Rewards edge headers are active on the canonical site.
- Authenticated New Reward admin access reaches the Air Express setup route
  `/admin/crm/cmmwe8so000077kqptwysqaem/setup`.
- James clarified the identity split: the New Reward app/control-plane access
  path is `james@jamesbrady.org`, and the Google provider account to connect
  from inside that app session is `newrewardplatform@gmail.com`.
- The New Reward setup page reports Air Express setup at `4/5`, but it is using
  a local setup snapshot because Search Console, GA4, Google Business Profile,
  and Google Business Profile sync failed to load.
- Managed activation profile is now `Complete`, with business facts, approved
  service areas, access, and approval policy complete. A platform override is
  approved, but payment/subscription confirmation is not recorded.
- New Reward still marks GSC, GA4, and Google Business Profile as
  `NOT CONNECTED` for the selected Air Express website. GSC is missing scopes
  and website property; GA4 is missing analytics scope and GA4 property.
- New Reward settings confirm the client website as
  `https://airexpressutah.com`.
- New Reward website delivery shows direct production writes off,
  `Cloudflare artifacts = CLOUDFLARE_EDGE`,
  `Owned-site content = MANUAL_REQUIRED`, `GitHub App = NOT CONNECTED`,
  `Vercel = MISSING`, execution mode `draft_preview`, and outreach mode
  `proof_mode`.
- New Reward SEO workspace opens at
  `/admin/crm/cmmwe8so000077kqptwysqaem/seo-optimization`, but reports
  `Client not found: cmmwe8so000077kqptwysqaem`.
- New Reward Cloudflare delivery is stale even though the live site is serving
  through the edge.
- The live edge website id is `cmorqbs9j001r5nr1h25vosp8`.
- Production `/analytics.js` returns `404` and the live homepage exposes no
  GA4/GTM marker, even though repo-local source contains measurement ID
  `G-JZ7PY32EVX`.
- `/admin/` returns HTTP 200.
- `/api/auth` returns HTTP 500 due to a missing live
  `OAUTH_GITHUB_CLIENT_ID` environment variable.
- `airexpresshvac.net` mail has MX, SPF, and DMARC, but the verifier found no
  DKIM TXT record for checked selectors.

## Safety Gates

Blocked without explicit approval and provider access:

- Changing Cloudflare DNS or redirect rules.
- Changing Vercel domains, env vars, deployment protection, or deployments.
- Changing ServiceTitan credentials, campaign IDs, lead settings, or CRM data.
- Changing Turnstile widgets or secrets.
- Changing GitHub OAuth app settings or Vercel OAuth env vars.
- Sending emails or client/public communications.
- Claiming, creating, editing, or posting to public listings and socials.
- Paid plans, verification submissions, phone/postcard/legal/document gates.

## Onboarding Deliverable Map

| Deliverable | Repo-native file | Status |
|---|---|---|
| Entrypoint/current state | `README.md` | prepared |
| Local operating rules | `AGENTS.md` | already existed |
| Agent handoff | `AGENT_TRANSFER_PACKET.md` | prepared |
| Source evidence map | `docs/source-evidence-map.md` | prepared |
| Research report | `docs/research-report.md` | prepared |
| 80/20 plan | `docs/80-20-action-plan.md` | prepared |
| Issue board seed | `docs/issue-board-seed.md` | prepared locally |
| Account setup handoff | `docs/account-setup-handoff.md` | prepared |
| Access/channel matrix | `data/channel-access-status.csv` | prepared |
| Distribution ledger | `data/distribution-ledger.csv` | prepared |
| Benchmark queries | `data/benchmark-queries.csv` | prepared |
| Weekly scorecard | `data/weekly-scorecard.csv` | prepared |
| Google auth scope audit | `data/google-auth-scope-audit.csv` | prepared |
| Attribution work items | `data/attribution-work-items.csv` | prepared |
| ServiceTitan export readiness check | `data/servicetitan-export-access-check.json` | blocked by missing env keys |
| Issue 24-30 completion audit | `data/issue-24-30-completion-audit.csv` | prepared |
| Issue evidence alignment check | `data/issue-evidence-alignment-check.json` | prepared |
| Pages index | `pages/index.html` | prepared |
| Roadmap/performance page | `pages/roadmap-performance.html` | prepared |
| Issue 24-30 blocker report | `pages/issue-24-30-blocker-report.html` | prepared |
| Content readiness report | `pages/content-readiness-report.html` | prepared |
| GSC/GA4/GBP impact report | `pages/new-reward-impact-report.html` | blocked by read/API scopes |

## Dirty Worktree Risk

Initial git status showed unrelated dirty changes in launch and intake files,
including `api/_lib/intake.js`, `intake-form.js`, `styles.css`,
`tests/unit/intake.test.js`, Turnstile files, and existing docs. This pass only
adds onboarding/control artifacts and does not revert or rewrite those changes.
