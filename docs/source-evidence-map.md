# Air Express Source Evidence Map

Date: 2026-06-02
Last updated: 2026-06-05

Evidence classes:

- `repo_verified`: checked in this local repo.
- `live_verified`: checked with DNS, HTTP, or verification scripts.
- `public_source`: public web or listing result.
- `official_doc`: provider/platform documentation.
- `user_verified`: stated by James in this thread.
- `inferred`: likely from evidence, not dashboard-verified.
- `unknown`: not verified in this pass.

## Repo Evidence

| Fact | Status | Evidence |
|---|---|---|
| Repo has local Air Express operating rules | repo_verified | `AGENTS.md` |
| Launch sequence exists | repo_verified | `docs/air-express-launch-runbook.md` |
| Launch-day checklist exists | repo_verified | `docs/air-express-tomorrow-checklist.md` |
| Decap CMS is configured for GitHub backend | repo_verified | `admin/config.yml` |
| Self-hosted Decap OAuth setup is documented | repo_verified | `admin/OAUTH_SETUP.md` |
| Cutover verifier exists | repo_verified | `scripts/verify-cutover.mjs` |
| Email auth verifier exists | repo_verified | `scripts/verify-email-auth.mjs` |
| ServiceTitan lead visibility guide exists | repo_verified | `output/air-express-servicetitan-guide/client-guide.md` |

## Live Technical Evidence

| Fact | Status | Evidence |
|---|---|---|
| `airexpressutah.com` nameservers are Cloudflare | live_verified | `dig +short NS airexpressutah.com` returned `romina.ns.cloudflare.com` and `yisroel.ns.cloudflare.com` |
| `airexpressutah.com` serves HTTP 200 | live_verified | `curl -I -L https://airexpressutah.com` |
| `www.airexpressutah.com` serves HTTP 200 | live_verified | `npm run verify:cutover` |
| `airexpresshvac.net` redirects to canonical site | live_verified | `curl -I -L https://airexpresshvac.net`; `npm run verify:cutover` |
| New Rewards edge is active | live_verified | live response includes `x-newrewards-edge-active-version`, `x-newrewards-edge-installation-key`, and `x-newrewards-edge-route-mode` |
| Live edge website id | live_verified | `https://airexpressutah.com/` returns `x-newrewards-edge-website-id: cmorqbs9j001r5nr1h25vosp8` |
| Live `/robots.txt`, `/llms.txt`, and `/sitemap.xml` load | live_verified | public HTTP checks returned 200 on the same New Reward edge website id |
| Live `/analytics.js` is missing | live_verified | `npm run verify:live-measurement` writes `data/live-measurement-path-check.json`; latest status is `fixed_locally_pending_live`. Local public page coverage is `120/120`, with no duplicate measurement sources and no unapproved GTM containers. `https://airexpressutah.com/analytics.js` returned HTTP 404 on edge website id `cmorqbs9j001r5nr1h25vosp8`, and the live homepage check did not expose `G-JZ7PY32EVX`, `GTM-`, `gtag`, `dataLayer`, `googletagmanager`, or `google-analytics` markers. |
| Cloudflare Turnstile source is prepared but not live | repo_verified / live_verified | Git commit `27cf80099165065e7f5bd0c0ca49d595326c4c44` added `api/_lib/turnstile.js`, `api/turnstile/config.js`, intake Turnstile rendering, and server-side token verification on 2026-06-04. Live checks on 2026-06-05 found public form pages and `/intake-form.js` still serving older assets with no Turnstile markers, and `https://airexpressutah.com/api/turnstile/config` returned HTTP 404. Treat CAPTCHA as `source_ready_pending_live_verification`, not verified live lead-quality impact. |
| Owned-site delivery sync is pending | live_verified | `npm run verify:owned-site-delivery-sync` writes `data/owned-site-delivery-sync-check.json`; latest status is `pending_delivery_sync`. Local `index.html` and `analytics.js` contain the approved GA4 source, while live homepage and `/analytics.js` are missing the critical measurement artifact. Live `llms.txt`, `sitemap.xml`, and `robots.txt` currently differ from repo-local files or are edge-managed. |
| Owned-site delivery sync packet is prepared | repo_verified | `npm run prepare:delivery-sync-packet` writes `docs/air-express-owned-site-delivery-sync-packet.md`. The packet lists P0 homepage and `analytics.js` sync requirements, noncritical `llms.txt`, sitemap, and robots drift, the local-but-not-live `blog/first-hot-week-ac-checklist-utah.html` URL, stop gates, and post-sync verification commands for #28. |
| Local site-file manifest is complete | repo_verified | `npm run verify:site-file-manifest` writes `data/site-file-manifest.json`; latest status is `passed`. It verifies required publish artifacts, sitemap URLs to local public HTML, local public HTML in the sitemap, valid local sitemap lastmods, generated non-draft blog posts, excluded draft posts, and local static references. It also removed a stale `financing.html` dependency on a legacy `/wp-content/uploads/.../Momnt-Logo-Full-Color.svg` URL that currently returns HTTP 403. |
| Public claim register is clean | repo_verified | `npm run verify:public-claims` writes `data/public-claim-register.json`; latest status is `passed`. Current local source uses `BBB Business Profile` instead of unsupported `BBB Accredited` wording. Review/rating, response-time, financing, license, certification, and dealer-status claims remain proof-gated until current owner/provider proof is supplied. |
| `/admin/` loads | live_verified | `curl -I -L https://airexpressutah.com/admin/` returned HTTP 200 |
| `/api/auth` is not healthy | live_verified | GET returned HTTP 500 with missing `OAUTH_GITHUB_CLIENT_ID` hint |
| Legacy mail has MX/SPF/DMARC | live_verified | `npm run verify:email-auth -- --host airexpresshvac.net` |
| Legacy DKIM is missing for checked selectors | live_verified | same verifier failed DKIM |

## New Reward Control-Plane Evidence

| Fact | Status | Evidence |
|---|---|---|
| Air Express setup route is reachable | live_verified | Authenticated admin session opened `/admin/crm/cmmwe8so000077kqptwysqaem/setup` without exposing secrets |
| Setup progress changed | live_verified | Setup page now reports Air Express `4/5`, superseding earlier `3/5` evidence |
| Provider data load is unhealthy | live_verified | Setup page says it is using a local setup snapshot because Search Console, GA4, Google Business Profile, and Google Business Profile sync failed to load |
| Google provider cards are not connected | live_verified | GSC, GA4, and GBP setup cards remain `NOT CONNECTED` for the selected website |
| New Reward app and Google provider identities are distinct | user_verified | James clarified that New Reward app access is under `james@jamesbrady.org`, while `newrewardplatform@gmail.com` is the Google account to connect to the app for provider records |
| Client website is canonical | live_verified | New Reward settings profile shows website `https://airexpressutah.com` |
| Owned-site delivery is not fully wired | live_verified | Website delivery shows `Cloudflare artifacts = CLOUDFLARE_EDGE`, `Owned-site content = MANUAL_REQUIRED`, `GitHub App = NOT CONNECTED`, `Vercel = MISSING`, execution mode `draft_preview`, and outreach mode `proof_mode` |
| SEO workspace mapping is broken | live_verified | `/admin/crm/cmmwe8so000077kqptwysqaem/seo-optimization` opens but reports `Client not found: cmmwe8so000077kqptwysqaem` |
| Google provider account is local but under-scoped | repo_verified | `npm run pull:gsc-ga4-history -- --skip-gbp` confirms `newrewardplatform@gmail.com` is available through local token sources. The sanitized scope inventory shows cloud/admin identity scopes, but neither token has `webmasters.readonly` or `analytics.readonly`. Google Business Profile is excluded from the current refresh and remains a separate later lane. |
| Google read-only reconnect packet is prepared | repo_verified | `docs/air-express-google-readonly-reconnect-packet.md` lists the approved identity model, required GSC/GA4/GBP scopes, stop gates, pull commands, expected output files, and pass/fail criteria for #27/#29. A 2026-06-04 local repair attempt confirmed gcloud requires `cloud-platform` alongside the product read scopes for this ADC flow, then stopped at an interactive OAuth verification-code gate. `data/google-history/google-readonly-token-repair-attempt.json` stores only sanitized attempt metadata. No OAuth consent code, token, credential file, or provider mutation was entered or stored. |
| Current configured NewRewards DB recheck finds Air Express rows | repo_verified | `npm run verify:newreward-mapping` now returns `rows_found` from a configured NewRewards production env source. It records Air Express client `cmmwe8so000077kqptwysqaem`, tenant `cmmwe8ri500007kqpd05kb4e5`, primary website `cmorqbs9j001r5nr1h25vosp8` matching the live edge website id, non-primary `www.airexpressutah.com` and legacy `www.airexpresshvac.net` rows, expired GSC provider credential/connection rows for `sc-domain:airexpressutah.com` under `newrewardplatform@gmail.com`, expired GA4 provider credential/connection rows under the same website/account with `propertyId = null`, and valid Cloudflare provider rows. Earlier limited candidates still returned `no_rows_found` and are preserved as per-attempt evidence. No database URL, token, encrypted credential blob, raw provider payload, or customer data is stored. |
| Air Express activation/source-state drift is documented in NewRewards | repo_verified | `/Users/jamesbrady/Projects/NewRewards/docs/plans/2026-04-29-contract-client-activation-failsafe.md` records that Air Express CRM client `cmmwe8so000077kqptwysqaem` was manually promoted from `prospect` to `client` on 2026-04-29, with onboarding day and Fearless Rhino franchise billing owner set after signed-but-unpaid and stale reseller-contract readiness drift. This supports #26 root cause and means the next production read-only check must verify active client status, `primaryWebsiteId`, selected website id, SEO workspace resolution, and provider rows together. |
| New Reward mapping reconciliation packet is prepared | repo_verified | `docs/air-express-newreward-mapping-reconciliation-packet.md` lists known Air Express ids, read-only SQL templates, pass/fail criteria, fail-closed gates, and the approved next action for the correct New Reward production source or app session. It has not been executed against production and performs no writes. |
| NewRewards provider credential resolver was repaired locally | repo_verified | `platform-backend/src/modules/google-seo/services/gsc.service.ts` and `platform-backend/src/modules/ga4/services/ga4-connector.service.ts` now prefer exact website-scoped provider credentials and then fall back to known aliases or tenant-wide saved credentials; focused unit tests passed on 2026-06-03 |
| Chrome UI recheck path is not callable in this session | repo_verified | Chrome is running, Google Chrome is installed, the Codex Chrome Extension is installed/enabled in the selected profile, and the native host manifest is correct. The Chrome browser-control MCP namespace was not exposed in this session, so the Air Express New Reward setup/SEO workspace UI could not be rechecked through the approved authenticated-browser path. No cookies, local storage, passwords, session stores, OAuth flows, provider connect actions, saves, jobs, or production mutations were inspected or changed. |
| Cross-repo New Reward state is mapped separately from Air Express attribution proof | repo_verified | `data/newreward-cross-repo-evidence.csv` records the Air Express vault client record, NewRewards #2876/#2880 paid-run repair state, NewRewards #3384/#3429 platform provider-state context, and NewRewards #3834 resolver closeout. This prevents a paid-run or New Reward-owned-site provider issue from being mistaken for current Air Express GSC/GA4/GBP access proof. |
| Mailbox evidence supports a traceability split | user_verified | Read-only Gmail and Outlook evidence from James's mailboxes includes a 2026-04-17 setup recap with GSC internal-service/primary-site mismatch, a 2026-04-22 recap about account-status tracking and possible credential/status drift, 2026-04-24/27 Outlook evidence for direct GA4 tag id `G-JZ7PY32EVX`, a 2026-05-07 training recap showing Air Express Google products as not connected in the demo, May 2026 Outlook package-link and missing-connection evidence, a 2026-05-27 Air Express note saying later notes showed GSC/GA4 live while GBP was not connected, and sanitized ServiceTitan proof from 2026-04-24. Scrubbed findings are recorded in `data/attribution-email-evidence.csv`; sign-in material, recovery material, token material, raw private messages, and customer PII are excluded. |
| Current Gmail measurement recheck found no new GTM or scoped Google proof | repo_verified | 2026-06-03 Gmail searches for Air Express plus GA4/GSC/GBP/GTM/Google Tag Manager terms returned the same setup-drift and GBP recovery evidence already recorded. Narrow Max Harding and GTM-specific searches returned no Air Express `GTM-...` container id, and exact GA4/domain searches returned no new property id, API scope, or provider-row proof. Sanitized row: `data/attribution-email-evidence.csv`. |
| Current Google Drive source search found no Air Express provider/tag proof | repo_verified | 2026-06-03 read-only Google Drive metadata searches for `airexpressutah`, `G-JZ7PY32EVX`, Air Express Google Analytics, Search Console, Business Profile, and ServiceTitan found no Air Express-specific GA4 property id, GTM container id, GSC property proof, GBP location proof, ServiceTitan export, or provider-row source file. A broad Business Profile query returned unrelated general-business files and is not Air Express evidence. Sanitized row: `data/attribution-email-evidence.csv`. |
| No Air Express GTM container ID found in searched evidence | repo_verified | Repo-local plus bounded Gmail and Outlook searches found the GA4 measurement id `G-JZ7PY32EVX` and `googletagmanager.com` gtag loader evidence, but did not find an Air Express-specific `GTM-...` container id. `data/attribution-email-evidence.csv` records no-result GTM, Google Tag Manager, Google tag, googletagmanager, gtag, Max Harding, and `GTM-` mailbox searches. `data/live-measurement-path-check.json` records `approvedGtmContainers: []`; stale `Google Tag Manager` comments were removed from local HTML so comments are not mistaken for a verified container. Do not add a GTM container until the approved id is found in Google Tag Manager, New Reward provider records, or owner evidence. |
| Air Express package/report links were not client-ready in May evidence | user_verified | Outlook evidence from 2026-05-05 and 2026-05-11 says an Air Express technical infrastructure package link/button was not working and a Social Media Strategy package link was broken before a requested walkthrough. This supports the public artifact readiness blocker and does not prove production artifacts are currently fixed. |
| Lead conversion tracking is prepared locally | repo_verified | `intake-form.js` emits a guarded GA4 `generate_lead` event after successful intake returns only when `window.gtag` exists; `contact.html`, `request-estimate.html`, and `schedule-service.html` each load `/analytics.js`, load `intake-form.js`, and expose `data-intake-form`; `api/_lib/intake.js` passes safe `trace_id` and UTM fields into ServiceTitan notes. `data/live-measurement-path-check.json` records this as `prepared_source_pending_live`, and `npm run verify:onboarding-evidence` now verifies all three lead form paths individually. This is not live until approved deploy or edge sync. |
| ServiceTitan lead history is pulled through the option-c credential path | repo_verified | `npm run verify:servicetitan-export` now writes `data/servicetitan-export-access-check.json` with status `auth_ready_no_export` after pulling the separate Vercel `option-c` production env into a temp-only file. `npm run pull:servicetitan-lead-history` writes `data/servicetitan-api-lead-history-summary.json` and `data/servicetitan-api-lead-history-redacted.csv` with 78 redacted lead rows from 2026-01-01 through 2026-06-05, including 76 configured website campaign rows, service-type buckets, weekly zero-fill through the week beginning 2026-06-01, and CAPTCHA source-period markers. Stored fields exclude customer names, phone numbers, emails, addresses, summaries, lead URLs, raw payloads, credential values, and tokens. The remaining blocker is booked-job/revenue attribution: the CRM v2 leads response included 0 booking IDs and no approved revenue fields. |
| ServiceTitan booking/revenue join probe is partially readable but scope-blocked | repo_verified / official_doc | `npm run probe:servicetitan-attribution-joins -- --from 2020-01-01` writes `data/servicetitan-attribution-join-probe.json`. It confirms CRM export bookings is readable but returned 0 rows from the widened cursor, while JPM export jobs and Accounting export invoices, invoice items, and payments returned HTTP 403 `Scope validation failed` blockers. Current ServiceTitan docs identify the jobs export as requiring Job Planning and Management > Jobs (Read) and invoice-items export as requiring Accounting > Invoice Items (Read); the remaining accounting exports also require Accounting read entitlements. No credential values, tokens, raw payloads, customer PII, job summaries, invoice line text, or lead URLs are stored. |
| ServiceTitan redacted export import path is prepared | repo_verified | `npm run import:servicetitan-redacted-export` writes `data/servicetitan-redacted-export-template.csv` and `data/servicetitan-redacted-export-import-status.json`; current status is `awaiting_input`. `npm run test:servicetitan-redacted-import` verifies awaiting-input behavior, safe alias normalization, and PII column/value rejection without persisting raw private values. If an approved redacted CSV is supplied later, the command writes only safe lead id, date, campaign/source, service category, status, optional booking id, and approved sold/revenue marker fields. No ServiceTitan API call, CRM mutation, live test lead, Drive mutation, or production change occurs. |
| Local SEO/GEO source audit is clean for technical SEO and messaging | repo_verified | `npm run audit:seo-geo-attribution` on 2026-06-03 regenerated `data/seo-geo-attribution-audit.json` and `pages/seo-geo-attribution-report.html` with scores: technical `100`, GEO `90`, messaging `100`, attribution `25`. Remaining findings are live/provider sync blockers, not local metadata or messaging blockers. |

## Public Profile Evidence

| Surface | Status | Evidence |
|---|---|---|
| Canonical/legacy website content | public_source | public result for `https://www.airexpresshvac.net/` crawled recently; live `.net` now redirects to `.com` |
| Facebook | public_source | repo footer links `https://www.facebook.com/airexpresshvac/`; HTTP check returned 200 |
| Google review link | live_verified | repo footer link redirects to Google local write-review flow with place ID |
| Angi | public_source | `https://www.angi.com/companylist/us/ut/lehi/air-express-heating-and-air-conditioning-inc-reviews-3641163.htm` |
| MapQuest Utah listing | public_source | `https://www.mapquest.com/us/utah/air-express-heating-and-air-conditioning-286187347` |
| ContractorsUp | public_source | `https://www.contractorsup.com/87980` |
| Cylex | public_source | `https://www.cylex.us.com/company/air-express-heating-and-air-conditioning-5877278.html` |
| Manta | public_source | `https://manta-router.p.manta.com/c/mm5fv19/air-express-heating-air-conditioning-inc` |
| Lehi business license list | public_source | Lehi public business listings show Air Express Heating & Air at `628 E State St #1` |

## Official Provider Flow Sources

| Provider | Status | Evidence |
|---|---|---|
| Cloudflare Turnstile | official_doc | server-side Siteverify validation is mandatory; tokens are short-lived and single-use |
| Vercel domains/projects | official_doc | custom domains and env vars are project settings; project can have production and pre-production deployments |
| Decap CMS GitHub backend | official_doc | Decap backend uses configured auth/base URL to open a GitHub authorization flow |
| Google Business Profile reviews | official_doc | businesses can ask customers for reviews with a business link or QR code; replies are public |
| Apple Business Connect | official_doc | free portal to claim/manage Apple Maps and related Apple surfaces |
| Bing Places | official_doc | free service to claim existing listings or add new listings for Bing and Bing Maps |
| Nextdoor Business Page | official_doc | businesses claim or create a Business Page and may need verification documents |
| MapQuest business listings | official_doc | MapQuest listing management/duplicate handling exists through its business listings help/Yext flow |
| ServiceTitan JPM jobs export | official_doc | The jobs export is a read-only export feed requiring Job Planning and Management > Jobs (Read) |
| ServiceTitan Accounting invoice items export | official_doc | The invoice-items export is a read-only export feed requiring Accounting > Invoice Items (Read) |

Official links used:

- Cloudflare Turnstile server-side validation:
  `https://developers.cloudflare.com/turnstile/get-started/server-side-validation/`
- Vercel custom domains:
  `https://vercel.com/docs/concepts/projects/domains/add-a-domain`
- Vercel projects:
  `https://docs.vercel.com/docs/projects`
- Decap CMS backend overview:
  `https://decapcms.org/docs/backends-overview/`
- Google Business Profile review tips:
  `https://support.google.com/business/answer/3474122?hl=en-en`
- Apple Business Connect user guide:
  `https://support.apple.com/en-lamr/guide/apple-business-connect/welcome/web`
- Bing Places FAQ:
  `https://www.bingplaces.com/Home/MoreFAQ`
- Nextdoor business page:
  `https://business.nextdoor.com/en-us/getting-started/business-page`
- MapQuest business listings help:
  `https://help.mapquest.com/hc/en-us/categories/200432404-Business-Listings`
- ServiceTitan JPM export jobs:
  `https://developer.servicetitan.io/docs/apis/tenant-jpm-v2/endpoints/Export_Jobs`
- ServiceTitan Accounting export invoice items:
  `https://developer.servicetitan.io/docs/apis/tenant-accounting-v2/endpoints/Export_InvoiceItems`
- ServiceTitan Data Export API overview:
  `https://developer.servicetitan.io/docs/transactional-and-export-apis`

## Unknowns And Claim Limits

- Dashboard access is not verified for Vercel, Cloudflare, ServiceTitan,
  Turnstile, GitHub OAuth, Resend, Google Business Profile, Search Console,
  GA4, Apple Business Connect, Bing Places, MapQuest/Yext, BBB, Angi, Nextdoor,
  or direct socials.
- `james@jamesbrady.org` is the user-confirmed New Reward app/control-plane
  identity for this reconnect. `newrewardplatform@gmail.com` is the
  user-confirmed Google provider account and is present in expired GSC/GA4
  provider rows for canonical website `cmorqbs9j001r5nr1h25vosp8`.
- Complete GSC/GA4/GBP history is blocked by read scope, not account absence:
  `newrewardplatform@gmail.com` is active locally, but the available tokens lack
  Search Console, GA4, and Google Business Profile API scopes.
- The prepared Google reconnect packet does not grant access by itself. It is
  a safe execution packet for the approved identity, required scopes, stop
  gates, and verification commands after the New Reward UI/provider cards are
  confirmed to target `cmorqbs9j001r5nr1h25vosp8`.
- Homepage source has the approved GA4 measurement id locally, but no approved
  GTM container id was found in the repo or searched Gmail/Outlook evidence.
  Treat GTM as `unknown` until Google Tag Manager, New Reward provider records,
  or Max/Air Express owner evidence supplies a `GTM-...` id.
- The NewRewards backend resolver repair is merged/deployed and removes a
  false-negative credential lookup path. It does not mutate Google, create
  credentials, map the selected Air Express website id, or grant read scopes.
- Gmail/setup evidence shows conflicting GSC/GA4 states over time, which points
  to New Reward source-of-truth and provider mapping drift. It does not prove the
  current Google properties are absent, and it does not replace direct
  GSC/GA4/GBP API access.
- The CRM integration website id `cmnfh6pi9000dj47kvq1rhqo8` is now treated as
  legacy/non-primary drift context. The current read-only NewRewards DB row and
  live edge both identify `cmorqbs9j001r5nr1h25vosp8` as the canonical website
  id, but the live app UI/provider cards still need a read-only recheck before
  OAuth reconnect.
- Public profile presence does not prove New Reward has control.
- Review counts, ratings, licenses, badges, and claims must be treated as
  public-source evidence until owner/dashboard proof is supplied.
- Do not claim BBB accreditation unless the public BBB status changes or owner
  proof is supplied. The current local wording is limited to `BBB Business
  Profile`.
- No provider records were created, claimed, edited, submitted, or paid for in
  this pass.
