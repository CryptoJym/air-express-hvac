# Air Express Google Read-Only Reconnect Packet

Status: prepared only. Not executed. No OAuth consent, provider connection,
Google property selection, or New Reward provider mutation performed.

Last updated: 2026-06-04

Purpose: make #27/#29 executable after the canonical website id and expired
provider rows are confirmed in the live New Reward app and James approves
read-only Google access. This packet is for pulling GSC, GA4, and GBP history
through the approved New Reward/Google identities without mutating
Google properties, New Reward provider rows, DNS, Vercel, Cloudflare, GTM, or
ServiceTitan.

## Required Preconditions

Do not start OAuth or provider reconnect until all of these are true:

1. The New Reward app session is `james@jamesbrady.org` or another explicitly
   approved James/New Reward admin identity.
2. The Air Express CRM client id `cmmwe8so000077kqptwysqaem` resolves in the
   live New Reward UI or a narrowed app-route blocker is recorded.
3. The selected Air Express website id is confirmed as
   `cmorqbs9j001r5nr1h25vosp8`, matching the read-only DB proof and live edge
   website id.
4. The Google account to use is `newrewardplatform@gmail.com` or another
   explicitly approved Air Express owner/manager account.
5. The approved Google account can see:
   - the Search Console property for `airexpressutah.com`;
   - the GA4 property or web stream containing measurement ID `G-JZ7PY32EVX`;
   - the Air Express Google Business Profile location, if GBP history is in
     scope.
6. James has approved read-only reauth or provider reconnect in the active
   thread.

## Required Scopes

The current local token for `newrewardplatform@gmail.com` has cloud/admin
identity scopes, but lacks the data scopes needed for this lane.

| Surface | Required scope | Current status |
|---|---|---|
| Search Console | `https://www.googleapis.com/auth/webmasters.readonly` | missing |
| GA4 Data API | `https://www.googleapis.com/auth/analytics.readonly` | missing |
| Google Business Profile | `https://www.googleapis.com/auth/business.manage` | missing |
| Google Tag Manager | `https://www.googleapis.com/auth/tagmanager.readonly` | not requested; no verified Air Express `GTM-...` container id |

Official Google scope baseline checked on 2026-06-03:

- Search Console documents `webmasters.readonly` as the read-only OAuth scope:
  `https://developers.google.com/webmaster-tools/v1/how-tos/authorizing`
- Google Analytics Data API quickstart and method docs use
  `analytics.readonly` for read/report access:
  `https://developers.google.com/analytics/devguides/reporting/data/v1/quickstart?account_type=user`
- Google Business Profile OAuth docs require `business.manage`; that scope is
  broad, but it is the documented API scope for Business Profile access:
  `https://developers.google.com/my-business/content/implement-oauth`
- Google Tag Manager API docs use `tagmanager.readonly` for read-only
  container/workspace visibility. This is not required for the GSC/GA4/GBP
  history pull, but it is the clean verification path if Air Express actually
  has a GTM container:
  `https://developers.google.com/tag-platform/tag-manager/api/v2/authorization`

Implication: the current blocker is not a mismatch between this repo and Google
docs. It is that the available local credential has identity/cloud/admin scopes,
while the history pull needs the product-specific Google data scopes above and
property/location visibility for Air Express.

For the homepage tag, current evidence supports direct GA4 only:
`G-JZ7PY32EVX` is in repo-local source and owner/mail evidence, while bounded
repo, Gmail, Outlook, Drive, and NewRewards provider-row searches have not
found an approved Air Express `GTM-...` container id. Do not add a GTM marker
until the exact container id or read-only Tag Manager container proof is
available.

Current proof:

- `data/google-history/history-pull-status.json`
- `data/google-auth-scope-audit.csv`
- `pages/new-reward-impact-report.html`

## Approved Read-Only Local Reauth Command

Run only after approval. Stop at account chooser, MFA, recovery, owner
verification, unexpected scopes, or any account that is not approved.

```bash
gcloud auth application-default login newrewardplatform@gmail.com \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/business.manage,openid,https://www.googleapis.com/auth/userinfo.email \
  --disable-quota-project
```

This stores a local application-default credential. Do not print or commit the credential file. Do not paste access tokens or refresh tokens into chat, docs, issues, logs, or repo files.

2026-06-04 local recheck: the approved Google account is active locally, but
the current token still lacks `webmasters.readonly`, `analytics.readonly`, and
`business.manage`. Running the scoped ADC command without `cloud-platform` was
rejected by gcloud because this application-default flow requires
`cloud-platform`; running it with `cloud-platform` plus the product read scopes
started the browser OAuth flow and stopped at an interactive verification-code
gate. No OAuth code, token, credential file, or provider mutation was entered or
stored. Sanitized attempt details are recorded in
`data/google-history/google-readonly-token-repair-attempt.json`.

If a verified Air Express GTM container id is supplied later, run a separate
read-only Tag Manager verification instead of widening the history-pull command
by default:

```bash
gcloud auth application-default login newrewardplatform@gmail.com \
  --scopes=https://www.googleapis.com/auth/tagmanager.readonly,openid,https://www.googleapis.com/auth/userinfo.email \
  --disable-quota-project
```

Stop before any GTM publish, workspace edit, trigger edit, tag edit, or
container mutation.

## Pull And Verification Commands

After approved reauth or confirmed New Reward provider reconnect:

```bash
npm run pull:gsc-ga4-history
npm run audit:seo-geo-attribution
npm run verify:onboarding-evidence
```

If GA4 auto-selection cannot identify the property, first verify that the
property/web stream contains `G-JZ7PY32EVX`, then run:

```bash
npm run pull:gsc-ga4-history -- --ga4-property-id <GA4_PROPERTY_ID>
```

If Search Console has both domain and URL-prefix properties, prefer
`sc-domain:airexpressutah.com` when visible. If only a URL-prefix property is
available, use the exact canonical URL-prefix property for
`https://airexpressutah.com/`.

## Expected Output Files

When access works, `npm run pull:gsc-ga4-history` should write or refresh:

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

The report should compare:

- through `2026-03-11`: before the New Reward target brief;
- `2026-03-12` through `2026-04-23`: target brief to GA4/lead proof;
- `2026-04-24` forward: after GA4/lead proof.

## Pass / Fail Criteria

Pass only if:

- `history-pull-status.json` is no longer globally `blocked_local_token_scope`.
- GSC rows are pulled or the blocker identifies the exact missing property.
- GA4 rows are pulled or the blocker identifies the exact missing property or
  property ID mismatch.
- GBP rows are pulled or the blocker identifies the exact missing account,
  location, or API access issue.
- `pages/new-reward-impact-report.html` shows real period rows or narrowed
  provider-specific blockers.
- `data/seo-geo-attribution-audit.json` references the updated history status
  and still records remaining caveats.
- No token, cookie, credential, raw private email, customer PII, or provider
  secret is written to repo files.

Keep #27/#29 open if:

- the token still lacks any required scope;
- the approved account cannot see Air Express properties/location;
- the New Reward selected website id is still ambiguous;
- the SEO workspace still reports `Client not found`;
- the pull produces only zeros because access is absent rather than data being
  genuinely empty;
- ServiceTitan lead history is still unavailable for impact joining.

## Stop Gates

Stop before continuing if:

- the Google account chooser does not show `newrewardplatform@gmail.com` or
  another approved account;
- Google requests recovery, owner verification, billing, or unexpected expanded
  scopes;
- the visible GA4 property does not contain `G-JZ7PY32EVX`;
- the visible Search Console property is for the wrong domain;
- the visible Google Business Profile account does not contain Air Express;
- New Reward is about to save provider credentials to an unreconciled website
  id;
- any action would publish GTM, deploy the site, change DNS, alter Cloudflare,
  edit ServiceTitan, send public posts, or send external email without approval.

## Issue Close Criteria

#27 can close only after approved read-only Google access is proven or an exact
property/location-specific provider blocker is recorded.

#29 can close only after `pages/new-reward-impact-report.html` contains pulled
GSC/GA4/GBP history by period or exact provider-specific blockers, with the
source coverage and caveats recorded in issues and repo-local evidence.

#24 remains open until #26, #27, #28, #29, and #30 are closed or explicitly
blocked with exact evidence and no remaining local workaround.
