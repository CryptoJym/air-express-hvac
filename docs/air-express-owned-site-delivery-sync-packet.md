# Air Express Owned-Site Delivery Sync Packet

Generated: 2026-06-06T13:53:24.436Z

Status: prepared evidence packet. No provider mutation, DNS change, Vercel change, Cloudflare change, New Reward edge sync, ServiceTitan action, OAuth consent, public send, public post, or production deploy is performed by this packet.

## Objective

Move the locally prepared Air Express owned-site artifacts onto the live delivery path only after explicit approval, then verify the live site exposes exactly one approved measurement source for GA4 `G-JZ7PY32EVX`.

## Current State

- Owned-site delivery status: `pending_delivery_sync`.
- Live measurement status: `partial_live_www_only_canonical_pending`.
- Site-file manifest status: `passed`.
- Approved GA4 id: `G-JZ7PY32EVX`.
- Live edge website id: `cmorqbs9j001r5nr1h25vosp8`.
- Live edge version: `v20260601032350-675731b8-57d4bf`.
- Local public page measurement coverage: `120/120`.
- Live homepage HTTP: `200`; approved GA4 present: `false`.
- Live `/analytics.js` HTTP: `404`; approved GA4 present: `false`.
- WWW homepage HTTP: `200`; approved GA4 present: `true`.
- WWW `/analytics.js` HTTP: `200`; approved GA4 present: `true`.
- Apex Turnstile configured: `false`; WWW Turnstile configured: `false`.
- Approved GTM containers found locally: `none`.

## New Reward Edge Read-Only State

| Field | Value |
| --- | --- |
| Read-only edge status | edge_rows_found_no_db_blocker |
| Installation | ctgzwv38vxwunfmzp38t59hl9 |
| Access / deployment | GRANTED / LIVE |
| Route mode | ZERO_REDIRECT |
| Active version | cmpun9s5o000j5mmurn9m3dvk |
| Active package | 675731b8-e9be-4e86-ae71-7f11d5d51e47 |
| Artifact count | 29 |
| Active version latest | true |
| Latest deployment | LIVE at 2026-06-01T03:23:50.02 |
| Latest verification | PASS at 2026-06-01T03:24:04.67 |
| Latest ready package | READY TECHNICAL Month 3: Website Visibility Package - Air Express Heating and Air Conditioning |
| Latest review | OPEN for package a18eff41-5662-4dea-8fa4-f23380857e5f |

Interpretation: the read-only New Reward source currently shows the canonical edge installation as `GRANTED` / `LIVE`, with active version `cmpun9s5o000j5mmurn9m3dvk`. Live HTTP remains the source of truth for #28, and the canonical apex still lacks the approved GA4 marker, so the safe fix is an authenticated New Reward edge publish/republish or another approved canonical delivery sync followed by live verification.

## Artifact Sync Matrix

| Priority | Artifact | Local path | Live URL | Status | Local SHA | Live HTTP | Live SHA | Live website id | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P0 | homepage | index.html | https://airexpressutah.com/ | pending_delivery_sync | 8b56a4e732d3... | 200 | 04e813924c7c... | cmorqbs9j001r5nr1h25vosp8 | Approve the Air Express delivery path through deploy, New Reward edge sync, or manual artifact sync; then rerun npm run verify:owned-site-delivery-sync and npm run verify:live-measurement. |
| P0 | analytics_js | analytics.js | https://airexpressutah.com/analytics.js | pending_delivery_sync | aaa0a80c628a... | 404 |  | cmorqbs9j001r5nr1h25vosp8 | Approve the Air Express delivery path through deploy, New Reward edge sync, or manual artifact sync; then rerun npm run verify:owned-site-delivery-sync and npm run verify:live-measurement. |
| P1 | llms_txt | llms.txt | https://airexpressutah.com/llms.txt | live_drift | b1f97f1eaa06... | 200 | 2c8f46d0e198... | cmorqbs9j001r5nr1h25vosp8 | After the critical measurement path is live, sync this artifact or record the approved edge-managed exception. |
| P1 | sitemap_xml | sitemap.xml | https://airexpressutah.com/sitemap.xml | live_drift | e74b3c8efc2a... | 200 | d7e5e8ef1ab8... | cmorqbs9j001r5nr1h25vosp8 | After the critical measurement path is live, sync this artifact or record the approved edge-managed exception. |
| P1 | robots_txt | robots.txt | https://airexpressutah.com/robots.txt | live_drift | 91c04162fa5c... | 200 | b686011b1504... | cmorqbs9j001r5nr1h25vosp8 | After the critical measurement path is live, sync this artifact or record the approved edge-managed exception. |

## Prepared Sitemap URL Not Yet Live

| URL | HTTP status | Local path | Local file exists |
| --- | --- | --- | --- |
| https://airexpressutah.com/blog/first-hot-week-ac-checklist-utah.html | 404 | blog/first-hot-week-ac-checklist-utah.html | true |

## Approved Delivery Paths

Use exactly one approved path, recorded in the issue or handoff before execution:

1. Connect the New Reward GitHub App and Vercel delivery path for the Air Express website.
2. Use an approved New Reward edge/manual artifact sync for the files in the artifact matrix.
3. Use an explicitly approved Air Express production deploy path.

If the operator chooses an edge-managed exception for `llms.txt`, `sitemap.xml`, or `robots.txt`, record the approved canonical source and keep homepage plus `analytics.js` as the P0 measurement artifacts.

## Stop Gates

- Stop if the live website id is not `cmorqbs9j001r5nr1h25vosp8`.
- Stop if an unverified `GTM-...` container appears; no approved Air Express GTM container id has been found.
- Stop if the sync path requires DNS, Cloudflare, Vercel, New Reward provider, Google, ServiceTitan, OAuth, public post, or public send mutation without explicit approval in the active thread.
- Stop if a provider asks for passwords, recovery codes, verification codes, token files, customer PII, or live test lead creation.

## Pre-Sync Verification

Run before any approved delivery action:

```sh
npm run verify:site-file-manifest
npm run verify:public-claims
npm run verify:owned-site-delivery-sync
npm run verify:live-measurement
npm run verify:onboarding-evidence
```

Expected pre-sync state from this packet:

- `verify:site-file-manifest` status is `passed`.
- `verify:public-claims` status is `passed`.
- `verify:owned-site-delivery-sync` status is `pending_delivery_sync`.
- `verify:live-measurement` status is `partial_live_www_only_canonical_pending`.

## Post-Sync Verification

Run after the approved delivery action:

```sh
npm run verify:owned-site-delivery-sync
npm run verify:live-measurement
npm run audit:seo-geo-attribution
npm run verify:onboarding-evidence
npm run prevercel-build
```

Expected post-sync proof for #28:

- Live homepage or live `/analytics.js` exposes exactly one approved GA4/GTM source.
- If GA4 is direct, the approved source is `G-JZ7PY32EVX`.
- No unapproved GTM container is present.
- `contact.html`, `request-estimate.html`, and `schedule-service.html` remain covered by the guarded `generate_lead` source path.
- Any lead-event proof uses GA4 Realtime/DebugView or an explicitly approved non-duplicating test. Do not create duplicate ServiceTitan leads.

## Issue Close Criteria

#28 can close only when:

- `npm run verify:live-measurement` reports a canonical live approved measurement source instead of `partial_live_www_only_canonical_pending`.
- `npm run verify:owned-site-delivery-sync` no longer reports P0 `homepage` or `analytics_js` as `pending_delivery_sync`.
- `npm run audit:seo-geo-attribution` reflects the live measurement state.
- The issue comment includes the exact command outputs, live website id, and any approved edge-managed exceptions for noncritical artifacts.
