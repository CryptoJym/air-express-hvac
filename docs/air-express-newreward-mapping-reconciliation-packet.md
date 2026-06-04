# Air Express New Reward Mapping Reconciliation Packet

Status: prepared only. This packet is not executed against production. No database writes or provider mutations performed.

Last updated: 2026-06-03

Purpose: record the #26/#27/#29 source mapping now that a configured
NewRewards production env source returns Air Express rows. The next step is no
longer another resolver-code change or broad source search; it is a read-only
New Reward app/UI recheck and an approval-gated Google provider refresh for the
canonical Air Express website id.

## Known IDs

| Item | Value |
|---|---|
| CRM client id | `cmmwe8so000077kqptwysqaem` |
| Tenant id | `cmmwe8ri500007kqpd05kb4e5` |
| CRM integration website id | `cmnfh6pi9000dj47kvq1rhqo8` |
| Live edge website id | `cmorqbs9j001r5nr1h25vosp8` |
| Canonical domain | `airexpressutah.com` |
| Legacy domain | `airexpresshvac.net` |
| GA4 measurement id | `G-JZ7PY32EVX` |
| New Reward app identity | `james@jamesbrady.org` |
| Google provider identity | `newrewardplatform@gmail.com` |

## Current Proof

- `npm run verify:newreward-mapping` writes
  `data/newreward-air-express-provider-readonly-recheck.json`.
- The script tested configured DB candidates read-only with `BEGIN READ ONLY`
  and `ROLLBACK`; it stores no database URLs, tokens, encrypted credential
  blobs, raw provider payloads, or customer data.
- The expanded configured source scan found a NewRewards production env source
  with Air Express rows. Earlier limited candidates still returned
  `no_rows_found` and remain recorded as per-attempt evidence.
- Air Express client `cmmwe8so000077kqptwysqaem` is present with status
  `client`, tenant id `cmmwe8ri500007kqpd05kb4e5`, website
  `https://airexpressutah.com`, and primary website id
  `cmorqbs9j001r5nr1h25vosp8`.
- Website `cmorqbs9j001r5nr1h25vosp8` is primary and canonical for
  `https://airexpressutah.com`, matching the live edge website id. Non-primary
  rows also exist for `www.airexpressutah.com` and legacy
  `www.airexpresshvac.net`.
- GSC provider credential `cmovx4dgo000o5nlkvdn9wd79` and GSC connection
  `cmovx4dd9000n5nlkxu3zzayr` target website
  `cmorqbs9j001r5nr1h25vosp8`, use `newrewardplatform@gmail.com`, and reference
  `sc-domain:airexpressutah.com`, but both are expired.
- GA4 provider credential `cmovx4t46000q5nlkn8ix3aup` and GA4 connection
  `cmovx4t7n000s5nlki14jmb69` target website
  `cmorqbs9j001r5nr1h25vosp8` under `newrewardplatform@gmail.com`, but both
  are expired and the GA4 connection has `propertyId = null`.
- Cloudflare provider rows exist, including a valid row for the canonical
  website id, but Cloudflare is not the approval target for this reconnect lane.
- NewRewards PR #3834 is merged/deployed, so exact-row-only provider lookup is
  not the remaining known blocker.
- NewRewards source documentation records a 2026-04-29 Air Express manual
  activation correction: CRM client `cmmwe8so000077kqptwysqaem` was promoted
  from `prospect` to `client`, onboarding day was set, and franchise billing
  owner was assigned to Fearless Rhino after signed-but-unpaid and stale
  reseller-contract readiness drift. The current read-only database evidence
  now confirms active client state and primary website mapping.

## Read-Only Reconciliation Queries

Run these only against the authorized production source of truth or read
replica. Do not paste connection strings, database URLs, encrypted credential
data, access tokens, refresh tokens, cookies, or raw provider credential blobs
into issues, docs, or chat.

```sql
BEGIN READ ONLY;

SELECT
  id,
  "tenantId",
  "companyName",
  website,
  status,
  "primaryWebsiteId",
  "clientActivatedAt",
  "onboardingDayOfWeek",
  "billingOwnerTenantId",
  "updatedAt"
FROM "Client"
WHERE id = 'cmmwe8so000077kqptwysqaem'
   OR "tenantId" = 'cmmwe8ri500007kqpd05kb4e5'
   OR lower(coalesce("companyName", '')) LIKE '%air express%'
   OR lower(coalesce(website, '')) LIKE '%airexpressutah.com%'
   OR lower(coalesce(website, '')) LIKE '%airexpresshvac.net%'
ORDER BY "updatedAt" DESC;

SELECT
  id,
  "tenantId",
  "clientId",
  "brandId",
  name,
  domain,
  "canonicalUrl",
  "gscProperty",
  "gaPropertyId",
  status,
  "isPrimary",
  "updatedAt"
FROM "Website"
WHERE id IN ('cmnfh6pi9000dj47kvq1rhqo8', 'cmorqbs9j001r5nr1h25vosp8')
   OR "tenantId" = 'cmmwe8ri500007kqpd05kb4e5'
   OR "clientId" = 'cmmwe8so000077kqptwysqaem'
   OR lower(coalesce(domain, '')) LIKE '%airexpressutah.com%'
   OR lower(coalesce("canonicalUrl", '')) LIKE '%airexpressutah.com%'
   OR lower(coalesce(domain, '')) LIKE '%airexpresshvac.net%'
   OR lower(coalesce("canonicalUrl", '')) LIKE '%airexpresshvac.net%'
ORDER BY "updatedAt" DESC;

SELECT
  id,
  "tenantId",
  "websiteId",
  provider,
  "credentialType",
  "validationStatus",
  "tokenExpiresAt",
  "lastValidatedAt",
  "lastError" IS NOT NULL AS "hasLastError",
  "providerMetadata"->>'email' AS "providerEmail",
  "providerMetadata"->>'siteUrl' AS "providerSiteUrl",
  "providerMetadata"->>'propertyId' AS "providerPropertyId",
  "createdAt",
  "updatedAt"
FROM "ProviderCredential"
WHERE "tenantId" = 'cmmwe8ri500007kqpd05kb4e5'
   OR "websiteId" IN ('cmnfh6pi9000dj47kvq1rhqo8', 'cmorqbs9j001r5nr1h25vosp8')
   OR (
     lower(provider) IN (
       'gsc',
       'google_search_console',
       'ga4',
       'google_analytics',
       'google_business_profile',
       'gbp'
     )
     AND (
       lower(coalesce("providerMetadata"::text, '')) LIKE '%airexpressutah.com%'
       OR lower(coalesce("providerMetadata"::text, '')) LIKE '%airexpresshvac.net%'
       OR coalesce("providerMetadata"::text, '') LIKE '%G-JZ7PY32EVX%'
     )
   )
ORDER BY "updatedAt" DESC;

SELECT
  id,
  "tenantId",
  "websiteId",
  "siteUrl",
  email,
  "connectionStatus",
  "lastSyncAt",
  "lastError" IS NOT NULL AS "hasLastError",
  "createdAt",
  "updatedAt"
FROM "GscConnection"
WHERE "tenantId" = 'cmmwe8ri500007kqpd05kb4e5'
   OR "websiteId" IN ('cmnfh6pi9000dj47kvq1rhqo8', 'cmorqbs9j001r5nr1h25vosp8')
   OR lower(coalesce("siteUrl", '')) LIKE '%airexpressutah.com%'
   OR lower(coalesce("siteUrl", '')) LIKE '%airexpresshvac.net%'
ORDER BY "updatedAt" DESC;

SELECT
  id,
  "tenantId",
  "websiteId",
  "propertyId",
  email,
  status,
  "lastSyncAt",
  "lastError" IS NOT NULL AS "hasLastError",
  "createdAt",
  "updatedAt"
FROM "Ga4Connection"
WHERE "tenantId" = 'cmmwe8ri500007kqpd05kb4e5'
   OR "websiteId" IN ('cmnfh6pi9000dj47kvq1rhqo8', 'cmorqbs9j001r5nr1h25vosp8')
   OR "propertyId" = 'G-JZ7PY32EVX'
ORDER BY "updatedAt" DESC;

ROLLBACK;
```

Note: if the production schema uses tenant-wide provider credentials without a
website id, the provider credential row may have `websiteId` empty or null. In
that case, use tenant id plus provider metadata/email/property evidence to
confirm whether `newrewardplatform@gmail.com` is valid for Air Express before
starting a new OAuth flow.

If the production schema keeps billing-owner data on `Tenant` rather than
`Client`, add a read-only tenant lookup for `cmmwe8ri500007kqpd05kb4e5` and its
parent tenant. Record only IDs, role/type/status, billing-owner relationship,
and updated timestamps.

## Pass / Fail Criteria

Pass only if the authorized source proves all of the following:

- The Air Express CRM client id resolves to the active Air Express client.
- The active-client state is consistent with the 2026-04-29 manual activation
  correction, including `clientActivatedAt`, onboarding day, and Fearless Rhino
  billing-owner context where those columns exist.
- The SEO workspace can resolve `cmmwe8so000077kqptwysqaem`.
- The selected canonical website id remains
  `cmorqbs9j001r5nr1h25vosp8`.
- The selected website id is reconciled against the live edge website id
  `cmorqbs9j001r5nr1h25vosp8`.
- GSC and GA4 provider rows are connected or refreshed for
  `cmorqbs9j001r5nr1h25vosp8`, or remain explicitly expired with a
  property-specific reconnect path.
- GBP provider/location access is either connected or blocked with exact
  account/location evidence.
- GA4 points to the property or web stream containing `G-JZ7PY32EVX`.
- Any GTM path is backed by a verified Air Express `GTM-...` container id.

Fail closed if:

- The SEO workspace still returns `Client not found`.
- The selected website id changes away from `cmorqbs9j001r5nr1h25vosp8`
  without explicit source-of-truth evidence.
- GSC or GA4 provider rows remain expired without a reconnect path.
- GA4 still has no selected property id or property-stream proof.
- GBP remains unproven without an account/location-specific blocker.
- The Google account is not `newrewardplatform@gmail.com` or another explicitly
  approved Air Express owner/manager account.
- Any step requires writing provider credentials, running jobs, saving settings,
  deploying, or reconnecting OAuth without explicit approval.

## Prepared Next Action

1. Open the New Reward app as `james@jamesbrady.org`.
2. Confirm the setup, provider cards, and SEO workspace target website
   `cmorqbs9j001r5nr1h25vosp8`.
3. Record only redacted row presence, IDs, status, property/site URLs, provider
   email, and blocker state.
4. If the UI and row state stay aligned, approve a read-only Google reconnect for
   `newrewardplatform@gmail.com` with Search Console, Analytics, and Business
   Profile scopes.
5. Rerun `npm run pull:gsc-ga4-history`,
   `npm run audit:seo-geo-attribution`, and
   `npm run verify:onboarding-evidence`.
