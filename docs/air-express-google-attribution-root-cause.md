# Air Express Google Attribution Root Cause

Generated: 2026-06-05

## Status

Air Express Google attribution is not blocked because the account or assets are proven missing. The current evidence shows three separate problems:

1. The local `gcloud` and ADC tokens for `newrewardplatform@gmail.com` are cloud/admin scoped and do not include Search Console, GA4, or Google Business Profile product scopes.
2. New Reward production/source rows for Air Express do exist, but the current provider state is stale: GSC is revoked/error, GA4 is expired, and GA4 has no selected `propertyId`.
3. The public site delivery is split: `www.airexpressutah.com` serves the approved GA4 source, while canonical `airexpressutah.com` is still served by the New Reward edge artifact without the GA4 marker or `/analytics.js`.

## Verified Evidence

| Surface | Evidence | Meaning |
| --- | --- | --- |
| Local Google token | Tokeninfo for local `gcloud` and ADC identifies `newrewardplatform@gmail.com`, but visible scopes do not include `webmasters.readonly`, `analytics.readonly`, or `business.manage`. | This only blocks repo-local direct pulls. It does not prove the New Reward app was never granted access. |
| New Reward provider rows | Read-only provider recheck found Air Express client `cmmwe8so000077kqptwysqaem`, tenant `cmmwe8ri500007kqpd05kb4e5`, canonical website `cmorqbs9j001r5nr1h25vosp8`, 4 provider credential rows, 1 GSC connection, and 1 GA4 connection. | The records exist. The blocker is state/selection, not total absence. |
| GSC provider state | GSC credential `cmovx4dgo000o5nlkvdn9wd79` is `revoked`; GSC connection `cmpymwqgm00xv5mo5h3spvjfg` is `error`; site is `sc-domain:airexpressutah.com`. | Reconnect/refresh is required in New Reward. |
| GA4 provider state | GA4 credential `cmovx4t46000q5nlkn8ix3aup` is `expired`; GA4 connection `cmovx4t7n000s5nlki14jmb69` is `EXPIRED`; `propertyId` is blank. | Reconnect and select the GA4 property/web stream containing `G-JZ7PY32EVX`. |
| Saved New Reward data | Saved aggregate GSC snapshots exist: 24 rows, latest window `2026-05-06` to `2026-06-03`, 3,832 appearances, 5 clicks, connection status `connected`. GA4 saved snapshots are 0, normalized GSC query metric rows are 0. | New Reward has some historical GSC visibility data, but not full query/page/device or GA4 history. |
| OAuth scope definitions | New Reward code defines `webmasters.readonly`, `analytics.readonly`, and `business.manage` with offline consent paths. | I do not currently see a product scope-definition bug. |
| Gmail/meeting evidence | Read-only Gmail search found prior operational notes saying New Reward Google connection was attempted, GSC showed connected but primary site selection/internal service errors occurred, and Air Express GBP recovery/access needed separate owner-manager handling. | This supports the stale/mis-selected provider explanation. Sensitive credential/code content was not stored or repeated. |
| Local source | `index.html`, `analytics.js`, and lead-form pages include approved GA4 source `G-JZ7PY32EVX`; GA4 source was introduced in commit `6c5f02d` on 2026-04-24. | Repo source has the GA implementation. |
| Live `www` | `https://www.airexpressutah.com/` has `G-JZ7PY32EVX`; `https://www.airexpressutah.com/analytics.js` is HTTP 200 and has the approved marker. | The Vercel/www path is serving GA correctly. |
| Live apex | `https://airexpressutah.com/` lacks the approved GA4 marker; `https://airexpressutah.com/analytics.js` is HTTP 404; headers show New Reward edge website `cmorqbs9j001r5nr1h25vosp8`, version `v20260601032350-675731b8-57d4bf`, route mode `ZERO_REDIRECT`. | Canonical apex is stale/split from the `www` Vercel path. |

## What We Can Fix On Our End

### 1. Repo-local direct history pull

Run a local OAuth reauthorization for `newrewardplatform@gmail.com` with product scopes. This is a machine-local fix and requires completing Google’s browser/code flow outside chat:

```sh
gcloud auth application-default login newrewardplatform@gmail.com \
  --scopes=https://www.googleapis.com/auth/cloud-platform,https://www.googleapis.com/auth/webmasters.readonly,https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/business.manage,openid,https://www.googleapis.com/auth/userinfo.email \
  --disable-quota-project
```

After it completes:

```sh
npm run pull:gsc-ga4-history
npm run audit:seo-geo-attribution
npm run build:performance-over-time-report
```

This can pull direct history from this repo if the Google account can see the Air Express properties.

### 2. New Reward provider reconnect

Use the New Reward app as `james@jamesbrady.org`, open Air Express, confirm canonical website id `cmorqbs9j001r5nr1h25vosp8`, then reconnect:

- Search Console as `newrewardplatform@gmail.com`, selecting `sc-domain:airexpressutah.com`.
- GA4 as `newrewardplatform@gmail.com`, selecting the GA4 property/web stream that contains `G-JZ7PY32EVX`.
- GBP only after the Air Express owner/manager path is confirmed; prior evidence points to owner recovery or manager invite being required.

Acceptance proof:

- GSC credential status becomes valid/connected.
- GA4 credential status becomes valid/connected.
- GA4 `propertyId` is populated.
- New Reward produces GA4 snapshots and normalized GSC query/page/device rows.

### 3. Canonical apex GA delivery

The GA code is installed locally and live on `www`, but not live on the canonical apex. Fix one delivery path:

- Sync the New Reward edge artifact for website `cmorqbs9j001r5nr1h25vosp8` so apex serves the same source as `www`, or
- Route the canonical apex to the verified Vercel delivery path.

Acceptance proof:

```sh
npm run verify:owned-site-delivery-sync
npm run verify:live-measurement
```

Required result:

- `https://airexpressutah.com/` exposes `G-JZ7PY32EVX`.
- `https://airexpressutah.com/analytics.js` returns HTTP 200.
- No unapproved GTM container appears.

### 4. Turnstile/CAPTCHA delivery

The active production environment still needs approved `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`. This is separate from GA/GSC/GA4, but it affects form submissions and lead tracking proof.

Acceptance proof:

- `/api/turnstile/config` returns `configured=true` on canonical apex and `www`.
- A valid CAPTCHA lead-path proof reaches ServiceTitan and GA4 `generate_lead` without creating duplicate/dirty production data.

## Current Root Cause

The most likely root cause is not that Air Express never granted access. The better read is:

1. Access/connection was attempted through New Reward.
2. New Reward saved some aggregate GSC snapshots.
3. The current provider credential rows are now revoked/expired.
4. GA4 property selection was never persisted or has been lost.
5. Canonical apex is serving an older New Reward edge artifact, while `www` serves the updated GA implementation.

## Not Done Here

- No OAuth consent was completed.
- No provider credential was extracted or printed.
- No password, recovery code, verification code, token, or raw email body was stored.
- No Google, Cloudflare, DNS, Vercel, ServiceTitan, or New Reward provider mutation was performed in this pass.
