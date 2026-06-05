# Air Express Issue Board Seed

Date: 2026-06-01
Last updated: 2026-06-03

This began as a repo-local seed. On 2026-06-03, James explicitly requested
issue creation for the Air Express attribution lane, and the attribution issues
were synced to GitHub under `CryptoJym/air-express-hvac`.

## GitHub Issue Map

- #24: Air Express attribution traceability: restore GSC/GA4/GBP history and
  impact reporting
- #25: Ship NewRewards GSC/GA4 provider credential resolver repair for Air
  Express
- #26: Reconcile Air Express New Reward client, SEO workspace, and live website
  id mapping
- #27: Restore read-only Google provider access for Air Express GSC, GA4, and GBP
- #28: Deploy or sync Air Express GA4 tag source and verify single live
  measurement path
- #29: Pull Air Express GSC/GA4/GBP history and publish New Reward impact report
- #30: Join ServiceTitan lead proof to Air Express New Reward impact periods
- #31: Prepare Air Express blog/content opportunities for SEO and GEO lift

## Current Completion Audit

- Repo-local CSV: `data/issue-24-30-completion-audit.csv`
- GitHub Pages report: `pages/issue-24-30-blocker-report.html`
- Current result: #25 is complete; #24 and #26-#30 remain open because they
  require New Reward source mapping, Google read scopes, live delivery sync, or
  ServiceTitan lead-system health proof.

## Parent Issue: Air Express New Reward Onboarding Control Hub

TL;DR: Convert the existing Air Express repo into a controlled onboarding hub
with access, source-of-truth, distribution, and performance tracking while
preserving launch safety.

Scope:

- Maintain repo-local onboarding docs and ledgers.
- Track provider access and blockers.
- Separate verified, inferred, prepared, blocked, and not attempted state.
- Keep production mutations approval-gated.

Acceptance criteria:

- Access/channel matrix exists.
- Distribution ledger exists.
- Benchmark and weekly scorecard exist.
- Roadmap/performance page exists.
- Launch-state blockers are documented.
- Verification evidence is linked or summarized.

## P0-1: Reconcile Current Launch State

Acceptance criteria:

- Current DNS, redirect, Vercel, Cloudflare, and New Rewards edge states are
  recorded.
- Stale April runbook assumptions are identified without deleting the runbook.
- Owner confirms whether New Rewards edge live state is intended.

Boundaries:

- No rollback, DNS, worker, or deploy mutation in this issue.

## P0-2: Repair Decap CMS OAuth

Acceptance criteria:

- Vercel access and GitHub OAuth app state are verified.
- `OAUTH_GITHUB_CLIENT_ID` and matching secret are present in the intended
  environment.
- `/api/auth` returns the expected GitHub OAuth redirect.
- `/admin/` login is smoke-tested by an approved user.

Boundaries:

- No secret values in issue, docs, logs, or chat.
- No env var mutation without explicit approval.

## P0-3: Verify Legacy Mail DKIM

Acceptance criteria:

- Actual DKIM selector/source record for `airexpresshvac.net` is identified.
- DKIM verifier passes or the accepted missing-DKIM decision is documented.
- Mail routing remains unchanged.

Boundaries:

- No MX/SPF/DKIM/DMARC edits without owner and DNS approval.

## P0-4: Confirm ServiceTitan Lead Control

Acceptance criteria:

- Current ServiceTitan access owner is known.
- Current lead campaign and follow-up visibility are verified.
- One approved production form test appears in ServiceTitan with expected notes.

Boundaries:

- No live form test or CRM mutation without approval.

## P0-5: Establish Measurement Access

Acceptance criteria:

- Google Business Profile, Search Console, GA4, and call/form conversion access
  states are recorded.
- Benchmark queries are run and captured.
- Weekly scorecard has a first real baseline.

Boundaries:

- No account creation or linking without approval.

## P1-1: Repair Local/Profile NAP Foundation

Acceptance criteria:

- Existing Google, Apple, Bing, MapQuest, BBB, Facebook, Angi, Nextdoor, Yelp,
  Houzz, Thumbtack, and local license/profile states are searched.
- Correct listing vs duplicate/stale listing decisions are recorded.
- High-fit claim/repair actions are prepared with verification gates.

Boundaries:

- Search first; create only if absent and approved.
- Stop at paid, phone, postcard, legal, or document gates.

## P1-2: Prepare Direct Social Distribution

Acceptance criteria:

- Facebook access is verified.
- Instagram, YouTube, TikTok, LinkedIn, and Nextdoor states are classified.
- First approved owned URLs and post copy themes are drafted locally.

Boundaries:

- No public posts or sends without approval.

## P2-1: Expansion Surfaces And Partner Lanes

Acceptance criteria:

- Manufacturer/dealer locators, supplier partners, financing partners, local
  chambers, and referral lanes are evaluated.
- Paid or low-fit directories are explicitly excluded or parked.
- UTM and proof capture rules are defined before publishing.

Boundaries:

- Search first; create only if absent and approved.
- Stop at paid, phone, postcard, legal, or document gates.

## P2-2: Prepare Blog And Case-Study Content Opportunities

Acceptance criteria:

- Current blog and service-page inventory is checked before new URLs are
  recommended.
- Six to ten topic briefs are prepared with target query, buyer stage, outline,
  internal links, proof requirements, and attribution notes.
- Case-study opportunities are separated from publishable claims until Max or
  Air Express approves source proof.
- Draft outreach to Max exists locally for James to send or edit.

Boundaries:

- No public posts, CMS edits, production deploys, customer PII, testimonial
  claims, pricing claims, rebate claims, or case-study claims without explicit
  owner approval.
