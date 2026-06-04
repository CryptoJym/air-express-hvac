# Air Express New Reward GSC/GA4/GBP Reconnect Runbook

Date: 2026-06-02
Last updated: 2026-06-03

Purpose: reconnect Air Express Search Console, GA4, and Google Business Profile
attribution through New Reward without crossing provider, deployment, DNS, Cloudflare, Vercel,
ServiceTitan, or public-communication boundaries.

## Known Air Express IDs

| Item | Value | Status |
|---|---|---|
| Client | Air Express HVAC | verified |
| Canonical domain | `https://airexpressutah.com` | verified |
| New Reward app/admin identity | `james@jamesbrady.org` | user-confirmed control-plane access path |
| Expected Google provider account | `newrewardplatform@gmail.com` | user-confirmed Google OAuth/provider account, not the app login identity |
| New Reward CRM client id | `client:cmmwe8so000077kqptwysqaem` | verified in reachable records |
| New Reward tenant id | `cmmwe8ri500007kqpd05kb4e5` | verified in reachable records |
| Primary/canonical website id | `cmorqbs9j001r5nr1h25vosp8` | verified from read-only NewRewards DB rows and live edge headers |
| Legacy/non-primary website id | `cmnfh6pi9000dj47kvq1rhqo8` | retained for prior CRM integration drift context |
| GA4 measurement ID | `G-JZ7PY32EVX` | restored locally, live pending |
| GTM container ID | unknown | not found in repo-local or searched Gmail evidence |
| Live New Reward setup route | `/admin/crm/cmmwe8so000077kqptwysqaem/setup` | verified with authenticated admin session |
| New Reward SEO workspace route | `/admin/crm/cmmwe8so000077kqptwysqaem/seo-optimization` | opens but reports client not found |

## Root Cause Summary

Attribution is blocked by missing provider credential/status on the selected
Air Express website, plus a remaining source-of-truth split. James clarified on
2026-06-02 that the New Reward app/control-plane identity is
`james@jamesbrady.org`, while `newrewardplatform@gmail.com` is the Google
provider account to connect from inside that app session. This is not proof that
the Google properties do not exist:

- Authenticated New Reward admin access reaches the Air Express setup page.
- On 2026-06-02, the setup page reports Air Express at `4/5`, but it is using a
  local setup snapshot because Search Console, GA4, Google Business Profile, and
  Google Business Profile sync failed to load.
- Managed activation profile is now `Complete`, with business facts, approved
  service areas, access, and approval policy all complete.
- A platform override is approved, but payment or subscription confirmation is
  not recorded yet.
- The integration snapshot still marks Google Search Console, GA4, and Google
  Business Profile as `NOT CONNECTED`.
- Cloudflare delivery is present but stale.
- Website delivery settings show `Cloudflare artifacts = CLOUDFLARE_EDGE`,
  `Owned-site content = MANUAL_REQUIRED`, `GitHub App = NOT CONNECTED`, and
  `Vercel = MISSING`; execution mode is `draft_preview`, outreach mode is
  `proof_mode`, and direct production writes stay off.
- The SEO workspace opens but reports
  `Client not found: cmmwe8so000077kqptwysqaem`, with run state `not run` and
  credential health `unknown/not checked`.
- `newrewardplatform@gmail.com` is confirmed in read-only NewRewards DB rows as
  the saved GSC and GA4 provider email for canonical website
  `cmorqbs9j001r5nr1h25vosp8`, but those provider rows are expired. A New
  Reward app sign-in attempt as `newrewardplatform@gmail.com` should only be
  treated as evidence that it is not the app user identity, not as evidence
  against Google provider access.
- The current read-only NewRewards DB recheck reconciles the primary website id:
  Air Express client `cmmwe8so000077kqptwysqaem` has primary website
  `cmorqbs9j001r5nr1h25vosp8`, and the live Air Express edge reports the same
  id. Prior CRM integration evidence for `cmnfh6pi9000dj47kvq1rhqo8` is now
  treated as legacy/non-primary drift context.
- The approved GA4 measurement ID is present in repo-local source via
  `/analytics.js`, but production `/analytics.js` returns `404` and the live
  homepage still does not expose GA4/GTM. `npm run verify:live-measurement`
  records the current read-only proof in `data/live-measurement-path-check.json`.
- Bounded repo and Gmail searches did not find an Air Express `GTM-...`
  container id. The homepage should keep the verified GA4 path until a GTM
  container id is verified from Google Tag Manager, New Reward provider rows, or
  owner evidence.
- On 2026-06-03, a NewRewards backend read-path issue was repaired, merged, and
  deployed through PR #3834. Core GSC/GA4 services now look for the exact
  website-scoped provider credential first, then fall back to approved provider
  aliases and tenant-wide saved credentials. This matches the more permissive
  access-integrations snapshot behavior and prevents saved credentials from
  being reported missing solely because the row is tenant-wide or stored under
  an alias. The deployment is verified, but it is not database-reconciled proof
  that a usable Air Express provider credential exists.
- A post-deploy read-only database recheck now returns `rows_found` from a
  configured NewRewards production env source. It found the active Air Express
  client, the canonical website id `cmorqbs9j001r5nr1h25vosp8`, expired GSC
  credential/connection rows for `sc-domain:airexpressutah.com`, expired GA4
  credential/connection rows with `propertyId = null`, and valid Cloudflare
  rows. This means the remaining unblocker is provider refresh, Google read
  scopes/property visibility, SEO workspace UI verification, and live delivery,
  not another resolver-code change.
- The repeatable local recheck command is `npm run verify:newreward-mapping`.
  It runs targeted `BEGIN READ ONLY` lookups through `psql` and writes sanitized
  evidence to `data/newreward-air-express-provider-readonly-recheck.json`
  without database URLs, encrypted credential blobs, provider tokens, or session
  material.
- The prepared production/source-of-truth handoff is
  `docs/air-express-newreward-mapping-reconciliation-packet.md`. It contains
  the known Air Express ids, read-only SQL templates, pass/fail criteria, and
  fail-closed gates for the correct New Reward app session or production read
  replica. It has not been executed against production.
- The prepared Google read-only reconnect handoff is
  `docs/air-express-google-readonly-reconnect-packet.md`. It contains the
  required GSC/GA4/GBP scopes, identity model, stop gates, pull commands,
  output contract, and issue close criteria for #27/#29. It has not been
  executed, no OAuth consent was submitted, and no provider mutation occurred.

## Reconnect Procedure

1. Open the live New Reward app with the James/New Reward admin identity
   `james@jamesbrady.org`.
2. Navigate to the Air Express account setup surface for
   `client:cmmwe8so000077kqptwysqaem`.
3. Recheck the New Reward UI before reconnecting anything:
   - confirm the SEO workspace opens for CRM client
     `cmmwe8so000077kqptwysqaem`;
   - confirm setup/provider cards target website id
     `cmorqbs9j001r5nr1h25vosp8`;
   - stop if the UI still targets legacy/non-primary website id
     `cmnfh6pi9000dj47kvq1rhqo8`.
4. Confirm whether the deployed NewRewards provider-credential resolver reports
   the existing `newrewardplatform@gmail.com` GSC/GA4 provider rows as expired
   for Air Express before starting a fresh OAuth reconnect.
5. Treat `cmorqbs9j001r5nr1h25vosp8` as the canonical reconnect target unless
   the app shows newer explicit source-of-truth evidence.
6. From that New Reward app session, start the Google provider connect flow and
   select or confirm `newrewardplatform@gmail.com` at the Google account
   chooser.
7. Confirm `newrewardplatform@gmail.com` can see the Air Express Search Console
   property, preferably `sc-domain:airexpressutah.com`, or the exact canonical
   URL-prefix property for `https://airexpressutah.com/`.
8. Confirm `newrewardplatform@gmail.com` can see the Air Express GA4 property
   whose web stream uses measurement ID `G-JZ7PY32EVX`.
8a. Confirm `newrewardplatform@gmail.com` can see the Air Express Google
    Business Profile location before attempting GBP performance history.
8b. If the desired implementation is GTM rather than direct GA4, confirm the
    exact Air Express `GTM-...` container id before changing homepage source.
9. Connect GitHub App and Vercel, or record an approved manual sync path, before
   expecting repo-local `/analytics.js`, `llms.txt`, or sitemap changes to reach
   production.
10. Click the Search Console `Connect` action only after the account chooser or
   OAuth page clearly shows the approved Google account and the Air Express
   property scope. Stop at unexpected identity, recovery, billing, owner
   verification, or expanded-scope prompts.
11. Connect or repair GA4 against the same reconciled website id only after the
   visible property contains measurement ID `G-JZ7PY32EVX`.
12. If the live site has not yet picked up `/analytics.js`, deploy or sync through
   the approved Air Express launch path, then verify the live homepage exposes
   `G-JZ7PY32EVX` or the approved single GTM/GA4 source with
   `npm run verify:live-measurement`.
13. Rerun `npm run audit:seo-geo-attribution` and attach the regenerated
    `pages/seo-geo-attribution-report.html` plus
    `data/seo-geo-attribution-audit.json` as the repo-local proof.

## Stop Gates

Stop before making a change if any of these are true:

- The New Reward app is about to connect GSC/GA4 to the non-canonical website
  id.
- The active New Reward app session is not `james@jamesbrady.org` or another
  explicitly approved James/New Reward admin identity.
- The Google account chooser does not clearly show `newrewardplatform@gmail.com`
  or another approved Air Express Google owner/manager account.
- Google asks for owner verification, recovery, new scopes, billing, or account
  recovery.
- The visible GA4 property does not contain measurement ID `G-JZ7PY32EVX`.
- The visible Google Business Profile account does not contain the Air Express
  location, or Google asks for owner verification/recovery.
- The SEO workspace still reports `Client not found` for the Air Express CRM id.
- New Reward asks to install GitHub App, connect Vercel, run a job, launch a
  baseline scan, or save delivery settings without explicit approval.
- A live deploy, DNS, Cloudflare, Vercel, ServiceTitan, Turnstile, OAuth, or
  provider credential mutation would be required without explicit approval.
- Any field would require storing passwords, tokens, cookies, recovery codes, or
  private messages in the repo or chat.

## Verification Targets

- New Reward GSC integration row is connected for the canonical Air Express
  website id.
- New Reward GA4 integration row is connected for the same website id.
- New Reward Google Business Profile integration can read the Air Express
  location or records an exact account/location blocker.
- Live homepage source or browser network evidence shows one approved GA4/GTM
  source and no duplicate pageview firing.
- The SEO/GEO attribution report shows GSC and/or GA4 rows pulled, or a narrowed
  provider-specific blocker with exact evidence.
