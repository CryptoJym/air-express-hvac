# Air Express Account Setup Handoff

Date: 2026-06-02

Default account rules from the New Reward onboarding skill:

- Google-owned surfaces: `newrewardplatform@gmail.com`.
- New Reward app/control-plane identity for this reconnect:
  `james@jamesbrady.org`.
- Non-Google operator access: `support@newreward.com`.
- Business email sends: Outlook / `James@utlyze.com`.
- Do not store passwords, tokens, cookies, recovery codes, or raw private
  messages in repo files, issues, or handoffs.

Identity correction from James on 2026-06-02: sign into the New Reward app with
`james@jamesbrady.org`, then connect Google-owned provider surfaces from inside
that app session using `newrewardplatform@gmail.com`. Do not treat
`newrewardplatform@gmail.com` failing as a New Reward app user as evidence that
it cannot own or access the Air Express GSC/GA4/GBP provider records.

## Provider Access Requests

Request access or screenshots for these P0 providers before changing anything:

| Provider | Needed role/proof | Current state | Gate |
|---|---|---|---|
| Vercel `option-c` | project settings and env var visibility | New Reward website delivery says `Vercel = MISSING`; live `/api/auth` env var missing | approval required before env var edits, project connection, or deployment |
| Cloudflare | DNS zone, redirect rules, Turnstile, worker/route visibility | nameservers and edge headers live; New Reward setup says Cloudflare is stale; website delivery says `Cloudflare artifacts = CLOUDFLARE_EDGE` | approval required before DNS/worker/Turnstile edits |
| ServiceTitan | tenant `4378713196`, lead campaign, lead visibility | prior lead guide exists | approval required before live form or CRM actions |
| GitHub OAuth App | callback URL and client ID confirmation | setup doc exists; live client ID missing | approval required before OAuth edits |
| New Reward GitHub App | delivery automation connection | New Reward website delivery says `GitHub App = NOT CONNECTED`; owned-site content is `MANUAL_REQUIRED` | approval required before installing/connecting apps |
| GitHub repo | collaborator/editor access for CMS users | repo configured in Decap | owner invitation if editors need write access |
| Google Business Profile | manager/owner access plus Business Profile API scope | review link exists; use `james@jamesbrady.org` app session and `newrewardplatform@gmail.com` Google provider identity; local token currently lacks `business.manage` | owner verification and OAuth scope gate |
| Search Console | property access for canonical domain | Read-only DB proof finds expired GSC credential/connection rows for `sc-domain:airexpressutah.com`, website `cmorqbs9j001r5nr1h25vosp8`, and `newrewardplatform@gmail.com`; local token lacks `webmasters.readonly` | expired provider row plus Google scope/property gate |
| GA4 | property/admin access and approved tag source | Read-only DB proof finds expired GA4 credential/connection rows for website `cmorqbs9j001r5nr1h25vosp8` and `newrewardplatform@gmail.com`, with `propertyId = null`; local tag restored but live pending; local token lacks `analytics.readonly` | expired provider row plus property/scope/live-delivery gate |
| New Reward SEO workspace | CRM client and website mapping | Earlier route evidence reported `Client not found`; read-only DB proof now finds the client and canonical website row, so the UI needs a fresh read-only recheck | internal UI/source recheck gate |
| Resend | sender/domain settings and notification sender | runbook references optional env vars | no sender changes without approval |
| Email/DNS | current DKIM selector/source records | DKIM check failed on `.net` | mail owner and DNS approval required |

Consolidated owner request packet: `docs/air-express-access-request-packet.md`.
It covers Google, GTM, ServiceTitan export/history, live delivery approval,
social distribution access, and case-study proof. It is prepared only and has
not been sent.

## Claim/Create Rules

For every public profile:

1. Search for an existing correct listing.
2. Search for duplicates, stale NAP, and wrong-domain listings.
3. Prefer claim/admin access over creating a new profile.
4. Stop at phone, postcard, legal, document, paid, or owner-verification gates.
5. Record status in `data/channel-access-status.csv`.
6. Record distribution action in `data/distribution-ledger.csv` only after the
   destination URL is approved.

## Surface-Specific Notes

- Google Business Profile: verify owner access before profile edits or review
  replies. Review asks must use policy-safe language and approved channels.
- Apple Business Connect: claim/manage through Apple Business Connect after
  confirming existing Apple Maps place state.
- Bing Places: claim existing or add only if absent; use Microsoft account
  approved for New Reward operations.
- MapQuest/Yext: Utah listing exists publicly and appears owner verified, but
  control is unknown. Verify before edits.
- Angi: profile exists with poor public rating; treat as monitoring/repair
  strategy, not a review push target.
- Nextdoor: claim/create only with owner authorization; business verification
  may require official documents.
- BBB: site claims BBB accreditation; verify the official profile/control before
  using badge language in distribution.
- Facebook: page URL exists in site footer; verify admin role before posts.

## Current Blockers

- `/api/auth` is blocked by missing `OAUTH_GITHUB_CLIENT_ID`.
- `.net` DKIM is blocked by missing selector/source proof.
- GSC/GA4/GBP reporting is blocked by expired New Reward provider rows, missing
  Google read scopes/property or location proof, and live delivery gaps, not by
  proof that the Google properties do not exist.
  Authenticated admin access reaches
  `/admin/crm/cmmwe8so000077kqptwysqaem/setup`, where Air Express is now `4/5`.
  The page is using a local setup snapshot because Search Console, GA4, Google
  Business Profile, and Google Business Profile sync failed to load. The latest
  read-only DB proof shows expired GSC provider rows for
  `sc-domain:airexpressutah.com` and expired GA4 provider rows for the same
  canonical website id, with GA4 `propertyId = null`. James clarified the
  app/provider split: use
  `james@jamesbrady.org` for the New Reward app session, then connect or confirm
  `newrewardplatform@gmail.com` as the Google provider credential for the
  selected Air Express website.
- Sanitized Gmail evidence now includes April 22 and May 7 New Reward recaps
  that support account-status/source-of-truth drift: the team wanted a
  GA4/GSC/GBP/Cloudflare status list, investigated Google account disconnects
  and possible cross-tenant credential drift, and saw Air Express Google
  products as not connected in a demo. These notes do not provide current API
  scopes, property ids, or non-expired provider rows.
- New Reward managed activation is closer but not fully clean: the managed
  activation profile is now `Complete`, business facts, approved service areas,
  access, and approval policy are complete, and an override is approved, but
  payment/subscription confirmation is not recorded.
- New Reward owned-site delivery is not wired for repo-to-live traceability.
  Website delivery settings show direct production writes off,
  `Cloudflare artifacts = CLOUDFLARE_EDGE`, `Owned-site content =
  MANUAL_REQUIRED`, `GitHub App = NOT CONNECTED`, `Vercel = MISSING`, execution
  mode `draft_preview`, and outreach mode `proof_mode`.
- The New Reward SEO workspace is an internal blocker. Earlier route evidence
  reported `Client not found: cmmwe8so000077kqptwysqaem`, run state `not run`,
  and credential health `unknown/not checked`; the latest read-only DB proof
  now finds the client row, so the live UI needs a fresh recheck.
- The Air Express canonical website id is now reconciled in read-only DB and
  live edge evidence as `cmorqbs9j001r5nr1h25vosp8`. Prior CRM integration
  evidence for `cmnfh6pi9000dj47kvq1rhqo8` remains legacy/non-primary drift
  context. Recheck the live UI/provider cards before provider consent.
- Cloudflare is also a managed-delivery blocker in the live setup page:
  delivery edge is stale/refresh recommended and the setup warning says the
  Cloudflare account ID or target zone proof is missing.
- Current GA4 tag state is partially repaired locally: New Reward PM history
  says measurement ID `G-JZ7PY32EVX` was installed and live-verified on
  2026-04-24, Outlook evidence from April 24/27 preserves the same direct gtag
  implementation id, and the repo now restores that ID through `/analytics.js`
  plus public HTML/template includes. Live delivery is still missing the tag:
  `https://airexpressutah.com/analytics.js` returns `404` on the same New Reward
  edge website id `cmorqbs9j001r5nr1h25vosp8`, and the live homepage exposes no
  GA4/GTM marker.
- Outlook evidence from May 5 and May 11 also shows Air Express package/review
  links were reported broken before a client walkthrough. Treat public package
  and report distribution as blocked until a working link and production
  artifact path are verified.
- ServiceTitan lead proof is stronger but still incomplete. Gmail evidence
  verifies two April 24 lead IDs and a later April 29 note says the
  ServiceTitan email-notification fallback was added and production checks
  passed. A May 1 Notion notification also tracks a lead-visibility
  investigation. These are historical setup/visibility facts, not a full
  ServiceTitan export, booking report, or revenue report. A redacted export or
  screenshot packet is still required before #30 can close.
- Saved credential workarounds partially improved visibility but did not unblock
  the pull: a saved Chrome credential opened the live New Reward admin setup
  page, but Google OAuth/provider connection still did not complete. The bounded
  `newrewardplatform@gmail.com` app sign-in attempt only indicates that Gmail is
  not the New Reward app identity; James now identifies `james@jamesbrady.org`
  as the app identity. Saved
  Supabase REST key rejected, direct Supabase DB IPv6 unreachable, common
  Supabase poolers reject the saved project ref, the exported Supabase
  service-role points at a different schema, the saved Railway PAT is
  unauthorized, and local gcloud/ADC now include
  `newrewardplatform@gmail.com` but lack the Search Console, GA4, and Google
  Business Profile API scopes needed for history.
- Provider dashboard access is not confirmed.
- Public distribution is blocked until approved canonical URLs, profile access,
  and owner approval are recorded.
