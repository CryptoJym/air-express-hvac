# Air Express GSC/GA4 History And New Reward Impact Plan

Date: 2026-06-02
Last updated: 2026-06-05

## Goal

Pull the complete available Air Express Search Console and GA4 history, then
compare performance across New Reward operating milestones. Google Business
Profile is a separate later lane and is not included in the current pull.

## Current Finding

2026-06-05 retry: after NewRewards PR #4105 merged and deployed the
GSC/GA4/GBP same-origin auth proxy fix, the Air Express local history pull was
rerun for January-to-now with Google Business Profile intentionally excluded:

```sh
npm run pull:newreward-attribution-history
npm run pull:gsc-ga4-history -- --gsc-start-date 2026-01-01 --ga4-start-date 2026-01-01 --end-date 2026-06-05 --skip-gbp
```

The result is split:

- Saved New Reward snapshot history is available.
- Direct GSC/GA4 API history is still blocked because the local
  `newrewardplatform@gmail.com` `gcloud` and ADC tokens lack
  `webmasters.readonly` and `analytics.readonly`.
- Google Business Profile was not attempted in this pass.
- This means the missing bearer-token platform route is no longer the leading
  code blocker; the remaining blocker is GSC/GA4 product scope/property access,
  live delivery, and ServiceTitan booked-job/revenue joins.

Current saved-data baseline:

- GSC saved snapshots: 24 snapshots, latest window 2026-05-06 to 2026-06-03,
  3,832 appearances, 5 clicks, 0.1% CTR, 2,193 captured rows, average position
  38.0.
- GSC first-to-latest saved movement: +3,599 appearances, +1 click, +2,110 row
  coverage. CTR fell from 1.7% to 0.1% as broader query coverage appeared.
- AI visibility: 5,181 saved answer snapshots, 443 unique questions, 16
  mentions, 6 citations, across 7 engines.
- Engine distribution: all observed mentions/citations are currently from
  Perplexity; ChatGPT, Claude, Google AI, Google AI Overview, Copilot, and Grok
  show zero observed mentions/citations in the saved rows.
- Cloudflare AI traffic observability: 2,747 saved AI-traffic requests from
  2026-05-27 to 2026-06-05. This is crawl/traffic context, not lead or revenue
  proof.
- Lead/revenue joins: no saved New Reward LeadTouchpoint, LeadFormSubmission,
  LeadOpportunity, or LeadRevenueEvent rows exist for Air Express yet.
- ServiceTitan lead counts are now pulled from the read-only API path: 78
  redacted leads from 2026-01-01 through 2026-06-05, including 76 configured
  website campaign leads. No booking ids or approved revenue fields are present.
- Lead trend after the last observed lead week: 15 leads in the week beginning
  2026-05-18, then 0 leads in the week beginning 2026-05-25 and 0 leads in the
  current week beginning 2026-06-01.

`newrewardplatform@gmail.com` is present as a local `gcloud` account, but the
available local tokens do not include the read/API scopes needed for history:

- Search Console needs `https://www.googleapis.com/auth/webmasters.readonly`.
- GA4 needs `https://www.googleapis.com/auth/analytics.readonly`.
- Google Business Profile performance/location history would need
  `https://www.googleapis.com/auth/business.manage`, but GBP is excluded from
  this refresh.

The latest `history-pull-status.json` records sanitized `visibleScopes` for both
the `gcloud` and ADC token candidates. Those visible scopes are cloud/admin
or identity scopes, not GSC or GA4 data scopes; no access token, refresh
token, cookie, or recovery material is stored.

The generated proof is in:

- `data/google-history/history-pull-status.json`
- `pages/new-reward-impact-report.html`
- `data/google-auth-scope-audit.csv`
- `data/attribution-work-items.csv`
- `docs/air-express-google-readonly-reconnect-packet.md`

The New Reward source proof changed on 2026-06-03. `npm run
verify:newreward-mapping` now returns `rows_found` from a configured
NewRewards production env source:

- Air Express client `cmmwe8so000077kqptwysqaem` exists with tenant
  `cmmwe8ri500007kqpd05kb4e5` and primary website
  `cmorqbs9j001r5nr1h25vosp8`.
- Website `cmorqbs9j001r5nr1h25vosp8` is primary/canonical for
  `https://airexpressutah.com` and matches the live edge website id.
- GSC credential/connection rows exist for `sc-domain:airexpressutah.com`
  under `newrewardplatform@gmail.com`, but they are expired.
- GA4 credential/connection rows exist under the same website/account, but
  they are expired and `propertyId` is null.

So the source-of-truth question is narrowed. The current blocker is read-only UI
confirmation plus provider refresh/scope/property access, not proof that Air
Express rows are missing from New Reward.

The New Reward platform route proof changed again on 2026-06-05. PR #4105
merged to main at `bfa5fc67b2568fc337f1f5f4600a9e51b1525054` and post-merge
Vercel status reached success. It adds explicit `/api/gsc`, `/api/ga4`, and
`/api/gbp` proxy routes through the auth bridge after Air Express reconnect
attempts reported missing bearer-token behavior. If the live app reconnect still
fails after this deployment, capture the exact provider status/error and treat
the next root cause as provider account/scope/property/location state, not
frontend bearer-token forwarding.

The status JSON and impact report now include an explicit evidence state model
for `verified`, `inferred`, `prepared`, `blocked`, and `not_attempted` so the
report does not blur checked facts, likely-but-unproven provider state,
prepared repo work, access blockers, and approval-gated actions.

Latest local audit state:

- `npm run audit:seo-geo-attribution` on 2026-06-03 regenerated
  `data/seo-geo-attribution-audit.json` and
  `pages/seo-geo-attribution-report.html`.
- `npm run audit:seo-geo-attribution` on 2026-06-05 regenerated the same
  outputs after the Google retry. Scores are technical `100`, GEO `90`,
  messaging `100`, accessibility `100`, attribution `25`.
- The remaining high-severity findings are live/provider-state blockers:
  live GA4/GTM marker not synced, one prepared sitemap URL not live, live
  sitemap lastmod drift, live `llms.txt` drift, and edge-managed `robots.txt`
  drift.
- `npm run verify:owned-site-delivery-sync` now writes
  `data/owned-site-delivery-sync-check.json` with a read-only local-vs-live
  artifact comparison. The latest status is `pending_delivery_sync`: local
  `index.html` and `analytics.js` are ready, but live homepage and
  `/analytics.js` are not serving the approved measurement source.

Additional mailbox evidence under the James/New Reward app identity supports a
source-of-truth split rather than a clean "Google assets are absent" conclusion:

- A 2026-04-17 setup recap says the system could show connected while the
  primary-site dropdown did not show the expected site, and it called out a
  Search Console connection error/internal service error.
- A 2026-04-22 New Reward PM/debugging recap says account-status tracking for
  GA4/GSC/GBP/Cloudflare was needed and separately records a possible Google
  credential/status drift pattern across tenants.
- 2026-04-24 and 2026-04-27 Outlook evidence preserve the direct GA4 Google tag
  implementation id `G-JZ7PY32EVX`; this supports direct GA4 as the verified
  local tag path, not a verified GTM container.
- A 2026-05-07 training recap says Air Express Google products were shown as
  not connected in the demo and separately flags tenant/credential overwrite
  suspicion for Google account disconnects.
- 2026-05-05 and 2026-05-11 Outlook evidence says Air Express package/review
  links were broken before client walkthrough, which supports public artifact
  readiness gating.
- A 2026-05-27 Air Express access note says later notes showed GSC and GA4 live,
  while Google Business Profile was not connected.

These notes are useful for root cause, but they do not provide a usable Google
API token or a verified Air Express property/location mapping. The API pull
remains blocked until a read-only provider token can see the exact Search
Console property, GA4 property, and Google Business Profile location.

The prepared reconnect packet for that step is
`docs/air-express-google-readonly-reconnect-packet.md`. It is a safe execution
handoff only: no OAuth consent, provider reconnect, Google property selection,
or New Reward provider mutation has been performed from this repo lane.

2026-06-03 Gmail/source search update: bounded searches found the approved GA4
measurement id `G-JZ7PY32EVX` and the local GA4 loader, but did not find an Air
Express-specific `GTM-...` container id. Max Harding appears in the available
evidence as the strongest Google Business Profile recovery/access lead, not as a
GTM source. Do not add a GTM container to the homepage until the approved
container id is verified from Google Tag Manager, New Reward provider records,
or Air Express owner evidence.

2026-06-03 Gmail refresh: additional read-only searches for Air Express plus
`GTM-`, Google tag, googletagmanager, and gtag terms also returned no Air
Express GTM container id. The newly recorded April 22 and May 7 recaps support
source-of-truth and credential-status drift as the root-cause lane, not a local
homepage-source issue.

2026-06-03 current Gmail recheck: a fresh search for Air Express plus
GA4/GSC/GBP/GTM/Google Tag Manager terms returned the same setup-drift and GBP
recovery evidence already recorded. A narrow Max Harding/GTM search returned no
Air Express GTM container id, and exact GA4/domain searches returned no new
property id, API scope, or provider-row proof.

2026-06-03 Google Drive source recheck: read-only metadata searches for
`airexpressutah`, `G-JZ7PY32EVX`, Air Express Google Analytics, Search Console,
Business Profile, and ServiceTitan found no Air Express-specific GA4 property
id, GTM container id, GSC property proof, GBP location proof, ServiceTitan
export, or provider-row source file. This does not prove the assets are absent;
it only exhausts the currently connected Drive search workaround.

2026-06-03 Outlook refresh: Outlook searches for Air Express plus `GTM-` and
Google Tag Manager returned no matching GTM container evidence. Outlook searches
for `G-JZ7PY32EVX` returned direct gtag loader evidence from April 24 and April
27, matching the local direct-GA4 source implementation.

The sanitized mailbox evidence ledger is now:

- `data/attribution-email-evidence.csv`

It records message ids, dates, source findings, and blocker impact without
passwords, verification codes, recovery codes, token material, or customer PII.

2026-06-03 implementation update: the NewRewards backend credential read path
has been repaired, merged, and deployed. GSC and GA4 status/auth checks no
longer rely only on exact website-scoped `gsc` or `ga4` rows; the services now
prefer the exact canonical credential row and then fall back to known provider
aliases or tenant-wide saved credentials. NewRewards PR #3834 was squash-merged
to `main` in `h3ro-dev/NewRewards` at
`c83c2f0e859b8165fa1d191f6ed7d0d53ceda75f` on
`2026-06-03T13:33:04Z`. GitHub read-only verification shows green targeted QA
and production-preview gates, Production deployment `4919441936` reached Vercel
`success` at `2026-06-03T13:36:03Z`, and Railway production deployment
`4919401175` recorded success states before later inactive lifecycle statuses.
This removes one software-side false-negative path, but it does not provide the
missing Google OAuth scopes, reconcile the Air Express website id split, or
prove the current production credential database contains a usable Air Express
row.

2026-06-03 NewRewards source-state update: local source inspection found
`/Users/jamesbrady/Projects/NewRewards/docs/plans/2026-04-29-contract-client-activation-failsafe.md`.
It records that Air Express CRM client `cmmwe8so000077kqptwysqaem` required a
manual production correction on 2026-04-29 from signed-but-unpaid/prospect drift
into active client state with Fearless Rhino franchise billing-owner context.
This strengthens #26 as a source-of-truth/mapping blocker. It does not grant
Google scopes or prove provider rows.

## Complete History Definition

For Search Console, complete means all Search Analytics rows currently available
to the authorized property through `searchanalytics.query`. Google documents
that method as exposing the data available in the Search Console Performance
report and documents API export limits such as 50K rows per day per type per
property:

- `https://developers.google.com/webmaster-tools/v1/how-tos/search_analytics`
- `https://support.google.com/webmasters/answer/12919192`

For GA4, complete means all aggregate report rows available from the GA4 Data
API for the selected property. Google documents the Data API `runReport` method
for custom reports, and Google Analytics Help states that GA4 data retention
settings do not affect standard aggregated reports:

- `https://developers.google.com/analytics/devguides/reporting/data/v1/basics`
- `https://support.google.com/analytics/answer/7667196`

For Google Business Profile, complete means the available Business Profile
Performance daily metric time series for the verified Air Express location.
Google documents `locations.fetchMultiDailyMetricsTimeSeries` for daily
location metrics such as website clicks and call clicks, and documents
`https://www.googleapis.com/auth/business.manage` as the required OAuth scope:

- `https://developers.google.com/my-business/reference/performance/rest/v1/locations/fetchMultiDailyMetricsTimeSeries`

## Safe Re-Auth Step

Do not run this from an automated lane without explicit approval because it opens
an OAuth consent flow. When approved, use the provider account and read-only
scopes:

```bash
gcloud auth application-default login newrewardplatform@gmail.com \
  --scopes=https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/business.manage,openid,https://www.googleapis.com/auth/userinfo.email \
  --disable-quota-project
```

Then rerun:

```bash
npm run pull:gsc-ga4-history
npm run audit:seo-geo-attribution
```

To refresh the sanitized New Reward source-mapping evidence without printing
secrets, run:

```bash
npm run verify:newreward-mapping
```

If the New Reward app still reports `credential missing` after the deployed
resolver repair, inspect the current production ProviderCredential rows for
tenant `cmmwe8ri500007kqpd05kb4e5` and website ids
`cmnfh6pi9000dj47kvq1rhqo8` and `cmorqbs9j001r5nr1h25vosp8` without printing
token material. The expected safe output is provider, website id, validation
status, email, selected site/property metadata, timestamps, and error state.

2026-06-03 read-only provider recheck: the local NewRewards integration-health
setup found configured database candidates in `~/.config/newrewards/.env`, and
the integration-health report ran in `--no-email --json` mode. The repo-local
`npm run verify:newreward-mapping` command now repeats the targeted
`BEGIN READ ONLY` lookup for Air Express by known client id, tenant id, domain,
CRM integration website id, and live edge website id across the configured
candidates without printing database URLs. The latest sanitized evidence is
recorded in `data/newreward-air-express-provider-readonly-recheck.json`; it
confirms `DIRECT_URL` and the `psql_safe_uri` `DATABASE_URL` variant return no
Air Express `Client`, `Website`, `ProviderCredential`, `GscConnection`, or
`Ga4Connection` rows. The safe variant removes unsupported URI parameter names
such as `pgbouncer` before retrying and does not print or store connection
values. The checked source is populated but small: latest count-only summary
shows 5 `Client` rows, 4 `Website` rows, 1 `ProviderCredential` row, 0
`GscConnection` rows, and 0 `Ga4Connection` rows. This narrows the remaining
blocker to missing Air Express rows in that source, another production
source/read replica, or app-level source mapping outside the checked
candidates; it is not the deployed resolver code path.

If GA4 property auto-selection does not find Air Express by name, rerun with the
property ID after verifying it contains measurement ID `G-JZ7PY32EVX`:

```bash
npm run pull:gsc-ga4-history -- --ga4-property-id <GA4_PROPERTY_ID>
```

## Output Contract

When access is available, the puller writes:

- `data/google-history/gsc-daily-history.csv`
- `data/google-history/gsc-query-history.csv`
- `data/google-history/gsc-page-history.csv`
- `data/google-history/gsc-device-history.csv`
- `data/google-history/ga4-daily-history.csv`
- `data/google-history/ga4-channel-history.csv`
- `data/google-history/ga4-landing-page-history.csv`
- `data/google-history/ga4-event-history.csv`
- `data/google-history/gbp-daily-history.csv`
- `data/google-history/history-pull-status.json`
- `pages/new-reward-impact-report.html`

The report must preserve the evidence state model above even when the history
pull is blocked; a blocked Google scope is not proof that the Air Express
property, GA4 stream, or Business Profile location does not exist.

## Impact Periods

The impact report currently compares:

- Before New Reward target brief: through 2026-03-11.
- Target brief to GA4/lead proof: 2026-03-12 through 2026-04-23.
- After GA4/lead proof: 2026-04-24 through the latest available data.

Treat this as directional performance context until ServiceTitan lead and revenue
proof is joined.

## ServiceTitan Lead Proof

Current ServiceTitan lead-count access is available through the separate Vercel
`option-c` production credential path. A repeatable readiness check and pull
path record this without printing credential values:

- `npm run verify:servicetitan-export`
- `data/servicetitan-export-access-check.json`
- `npm run pull:servicetitan-lead-history`
- `data/servicetitan-api-lead-history-summary.json`
- `data/servicetitan-api-lead-history-redacted.csv`
- `npm run probe:servicetitan-attribution-joins`
- `data/servicetitan-attribution-join-probe.json`
- `npm run import:servicetitan-redacted-export`
- `data/servicetitan-redacted-export-template.csv`
- `data/servicetitan-redacted-export-import-status.json`

2026-06-05 ServiceTitan update: the API key path was found in the separate
Vercel `option-c` production project, not in the Air Express repo, NewRewards
repo env files, process env, or discoverable 1Password item names. After pulling
that env into a temp-only file, `npm run verify:servicetitan-export` returned
`auth_ready_no_export`, and `npm run pull:servicetitan-lead-history` pulled
read-only CRM v2 lead history for 2026-01-01 through 2026-06-05.

Pulled ServiceTitan lead-count baseline:

- 78 redacted lead rows.
- 76 rows for configured website campaign `80365413`.
- Impact periods: 2 before the New Reward target brief, 29 from target brief to
  GA4/lead proof, and 47 after GA4/lead proof.
- Status mix: 55 dismissed, 22 open, 1 converted.
- Service-type mix from safe fixed-keyword classification: 17 other, 13 AC
  repair, 13 maintenance/tune-up, 10 air quality, 9 heating/furnace, 7 heat
  pump, 5 emergency repair, and 4 unclassified.
- Latest weekly lead trend: 2026-05-18 had 15 leads; 2026-05-25 had 0 leads;
  2026-06-01 had 0 leads.
- Booked-job and revenue proof remains blocked: the lead endpoint returned 0
  booking IDs and no approved revenue fields.
- Booking/revenue join probe: a read-only 2020-to-now export probe found CRM
  export bookings readable with 0 rows, while JPM export jobs and Accounting
  export invoices, invoice items, and payments returned HTTP 403 scope
  validation failures. Root cause: the current ServiceTitan credential path can
  read lead history, but it is not entitled to the jobs/accounting read scopes
  required for booked-job or revenue attribution.
- Stored fields exclude customer names, phone numbers, emails, street addresses,
  lead summaries, lead URLs, raw payloads, credential values, and tokens.
- Cloudflare Turnstile/CAPTCHA source was added on 2026-06-04 in commit
  `27cf80099165065e7f5bd0c0ca49d595326c4c44`, but live public form assets are
  still older and `/api/turnstile/config` returns HTTP 404. Treat this as
  `source_ready_pending_live_verification`, not verified live CAPTCHA impact.
- Post-CAPTCHA-source lead count is currently 0, so there is no post-live data
  yet to claim improved lead quality.

A sanitized partial proof file still exists from prior verified email/repo guide
evidence:

- `data/servicetitan-lead-history.csv`
- `data/servicetitan-prior-proof-summary.csv`

The prior lead-history file records two April 24, 2026 website lead IDs under campaign
`80365413` without customer PII. The prior-proof summary preserves the
already-generated guide's count-only statement that five website leads were
created in ServiceTitan on April 24, 2026, with the same campaign and without
private customer data. This prior proof is now superseded for lead-count trend
work by the read-only API pull, but it remains useful corroborating evidence for
the April 24 lead-visibility milestone.

The generated impact report now has a `Lead Proof Status` section. It records
the API lead proof as `api_history_pulled`, the ServiceTitan auth state as
`auth_ready_no_export`, the pulled lead counts, campaign `80365413`, the
booking/revenue join probe state as `partial_join_surfaces_readable`, and the
no-PII boundary. It still does not claim booked jobs, revenue, ROI, or full
closed-won attribution.

2026-06-03 redacted export import update: a local-only import path is prepared
for owner-supplied ServiceTitan CSV evidence:

```bash
npm run import:servicetitan-redacted-export -- --input <path-to-redacted-csv>
```

The command rejects prohibited PII fields and obvious private values, then
writes only safe lead id, date, campaign/source, service category, status,
optional booking id, and approved sold/revenue marker fields. Current manifest
status is `awaiting_input`; no ServiceTitan API call, CRM mutation, live test
lead, Drive mutation, or production change occurred.

2026-06-03 ServiceTitan mailbox refresh: bounded Gmail searches for Air Express
ServiceTitan, lead, Follow Up Leads, campaign `80365413`, and the known lead
IDs found the existing April 24 proof, April 29 setup note, and May 1
missing-leads investigation thread. They did not find a full ServiceTitan
export, booking status, revenue report, or additional lead IDs beyond existing
proof.

2026-06-03 local attribution plumbing update: the lead forms now prepare a
guarded GA4 `generate_lead` event after a successful intake return, and the
intake payload carries safe non-PII attribution fields (`trace_id` plus UTM
parameters) into ServiceTitan notes and notification text. This is source-level
prepared evidence only; it still requires an approved deploy or New Reward edge
sync, then GA4 DebugView/Realtime proof or an approved test lead to verify live
event firing without creating duplicate ServiceTitan records.

The repeatable live measurement diagnostic is:

```bash
npm run verify:live-measurement
```

It writes `data/live-measurement-path-check.json` with public marker booleans,
edge headers, local GA4 source status, and prepared lead-event status. The
current state is `fixed_locally_pending_live`: local `index.html` and
`analytics.js` contain `G-JZ7PY32EVX`, but the live homepage still has zero
approved GA4/GTM sources and production `/analytics.js` returns HTTP 404.
