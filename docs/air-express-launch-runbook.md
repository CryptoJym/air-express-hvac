# Air Express Launch Runbook

Scope: phased launch for `airexpressutah.com` with ServiceTitan intake first, DNS cutover second, and New Reward worker rollout last.

Verified status in this repo as of 2026-04-13:

- Production ServiceTitan auth is working for tenant `4378713196`
- The Vercel intake handlers are deployed and production-smoked successfully
- `airexpressutah.com` and `www.airexpressutah.com` are attached to the Vercel project
- The latest verified production deployment URL is `https://option-77ete12ih-vuplicity.vercel.app`
- Vercel project protection mode is `all_except_custom_domains`
- The `.vercel.app` deployment URL requires Vercel auth, but the custom domains will be public after DNS cutover
- Production ServiceTitan env vars are present in Vercel
- Decap CMS OAuth env vars are present in Vercel and `/api/auth` has been verified against the canonical `airexpressutah.com` host header
- DNS has not been cut over yet
- Public nameservers for `airexpressutah.com` are still GoDaddy (`ns27.domaincontrol.com`, `ns28.domaincontrol.com`)

Non-negotiables:

- Canonical public site: `https://airexpressutah.com`
- `airexpresshvac.net` becomes redirect-only for web traffic
- Email continuity is preserved exactly
- ServiceTitan v1 is lead-first for every form
- The New Reward worker must not be introduced until the production site and forms are already stable

## Phase Separation

Phase 1:

- ServiceTitan integration environment is working
- Forms submit end-to-end to the Vercel intake layer
- Leads appear in the ServiceTitan integration tenant with the expected notes

Phase 2:

- Production ServiceTitan credentials are live
- `airexpressutah.com` and `www.airexpressutah.com` are attached in Vercel
- Cloudflare cutover is performed without changing mail records

Phase 3:

- New Reward worker is added in front of the live site
- Worker origin/fallback is pinned to the stable production Vercel alias already attached to this project, for example `option-c-vuplicity.vercel.app`, not an ephemeral preview URL and not `airexpressutah.com`
- Redirect-only behavior for `airexpresshvac.net` remains separate

## Recommended Operating Order

Operate in this order:

1. Keep the current Vercel production deployment as the release candidate
2. `/admin` is already wired in Vercel; include it in the public post-cutover smoke once DNS is live
3. Copy the current `airexpressutah.com` DNS zone into Cloudflare without changing any mail/auth records
4. Verify every MX, SPF, DKIM, and verification TXT record in Cloudflare against the pre-cutover source
5. Point only the website hostnames for `airexpressutah.com` to Vercel
6. Verify `airexpressutah.com` and `www.airexpressutah.com` serve the production deployment publicly
7. Add the web-only Cloudflare redirect from `airexpresshvac.net/*` to `https://airexpressutah.com/*`
8. Run the post-cutover smoke checks for page load, form submission, redirects, and mail continuity
9. Only after all of that is stable, put the New Reward worker in front of `airexpressutah.com`

## Phase 1 Prerequisites

Before launch work begins, confirm:

- ServiceTitan integration tenant responds with a valid access token
- Integration credentials are present and correct
- Vercel project is reachable and deployment access is available
- The final production host is locked to `airexpressutah.com`
- No email-related DNS records will be edited as part of website work

Credential checklist:

- `SERVICETITAN_ENV`
- `SERVICETITAN_TENANT_ID`
- `SERVICETITAN_APP_KEY`
- `SERVICETITAN_CLIENT_ID`
- `SERVICETITAN_CLIENT_SECRET`
- `SERVICETITAN_API_BASE_URL`
- `SERVICETITAN_AUTH_URL`
- `SERVICETITAN_LEAD_CAMPAIGN_ID`

Optional lead-routing overrides:

- `SERVICETITAN_LEAD_CALL_REASON_ID`
- `SERVICETITAN_LEAD_BUSINESS_UNIT_ID`
- `SERVICETITAN_LEAD_JOB_TYPE_ID`

Optional notification-email env vars:

- `RESEND_API_KEY`
- `INTAKE_NOTIFICATION_FROM`
- `INTAKE_NOTIFICATION_TO`
- `INTAKE_NOTIFICATION_CC`
- `INTAKE_NOTIFICATION_BCC`

Confirmed Air Express notification identity:

- Keep ServiceTitan as the primary lead system.
- Use `Air Express <office@airexpresshvac.net>` for `INTAKE_NOTIFICATION_FROM` once the sender domain is verified in Resend.
- Use `office@airexpresshvac.net` for `INTAKE_NOTIFICATION_TO` unless Air Express supplies a separate dispatch inbox.

Operational note:

- The live CRM lead-create endpoint requires `campaignId` and either `callReasonId` or `followUpDate`.
- This implementation always supplies `SERVICETITAN_LEAD_CAMPAIGN_ID`.
- If `SERVICETITAN_LEAD_CALL_REASON_ID` is not configured, the intake layer defaults the lead follow-up date to 24 hours after submission.
- If the Resend notification env vars are present, the intake layer also sends a non-blocking email notification after ServiceTitan accepts the lead.

Current blockers to clear before public cutover:

- Real ServiceTitan integration auth still returns `invalid_client`, so sandbox parity is not available
- DNS for `airexpressutah.com` still points to the registrar-managed zone, not Vercel
- The Cloudflare zone copy and nameserver cutover still need to be done outside this repo

## Phase 2 Vercel Domain Readiness

Attach both public website hostnames to the Vercel project before any DNS cutover:

- `airexpressutah.com`
- `www.airexpressutah.com`

Recommended operator flow:

1. Open the Vercel project
2. Add `airexpressutah.com` as the primary domain
3. Add `www.airexpressutah.com` as the secondary domain
4. Confirm the production deployment is serving the expected build
5. Confirm canonical, Open Graph, and schema URLs resolve to `airexpressutah.com`

Verified on 2026-04-13:

- Both domains are attached to the `option-c` Vercel project
- The active production deployment has both domains assigned as aliases
- The current production deployment successfully accepted a live `POST /api/intake/contact` and redirected to `/contact.html?intake=success`

If using the CLI, the intent is:

```bash
vercel domains add airexpressutah.com
vercel domains add www.airexpressutah.com
```

Only use those commands if the Vercel token is already valid.

## Phase 2 Cloudflare Cutover

Before changing nameservers or DNS:

1. Export or copy the existing GoDaddy DNS zone
2. Recreate all DNS records in Cloudflare
3. Preserve mail-related records exactly:
   - MX
   - SPF
   - DKIM
   - verification TXT
   - any other mail/auth records
4. Keep every mail-related record `DNS only`
5. Point only website hostnames to Vercel

Web cutover steps for `airexpressutah.com`:

1. Update apex and `www` website records to the Vercel targets
2. Verify the site resolves and loads from the new host
3. Do not alter mail records during this step

Redirect-only setup for `airexpresshvac.net`:

1. Leave all email records untouched
2. Create a Cloudflare Redirect Rule for `airexpresshvac.net/*`
3. Redirect to `https://airexpressutah.com/*`
4. Keep the rule web-only

## Phase 2 Post-Cutover Verification

Run these checks immediately after cutover:

- `airexpressutah.com` serves the new site
- `www.airexpressutah.com` resolves correctly
- `airexpresshvac.net` web traffic redirects to `airexpressutah.com`
- Mail still routes on both domains
- Canonical URLs point to `https://airexpressutah.com`
- Open Graph URLs point to `https://airexpressutah.com`
- Schema URLs point to `https://airexpressutah.com`
- No site references still depend on the preview host

Practical checks:

```bash
dig +short airexpressutah.com
dig +short www.airexpressutah.com
dig mx airexpressutah.com
dig mx airexpresshvac.net
curl -I https://airexpressutah.com
curl -I https://airexpresshvac.net
```

Automated check from this repo:

```bash
npm run verify:cutover
```

What the verifier checks:

- apex site responds on `https://airexpressutah.com`
- `www` responds on `https://www.airexpressutah.com`
- `contact.html` loads
- `/admin/` loads
- `/api/auth` returns the expected GitHub OAuth redirect with callback `https://airexpressutah.com/api/callback`
- `airexpresshvac.net` web traffic redirects to `https://airexpressutah.com`
- MX records still exist on both domains
- nameservers are queryable for `airexpressutah.com`

## Phase 3 New Reward Worker Rollout

Only start this after the production site and intake flow are stable.

Worker setup rules:

- Put the worker in front of `airexpressutah.com` only after launch verification
- Pin the fallback/origin to the stable production Vercel alias for this project, for example `option-c-vuplicity.vercel.app`, not `airexpressutah.com` and not an ephemeral preview deployment URL
- Do not use `airexpressutah.com` as the origin target, or requests can recurse
- Leave `airexpresshvac.net` as a plain redirecting domain

Recommended checks after the worker is enabled:

- Managed paths are served by the worker
- Normal site paths still fall through to Vercel
- Redirect-only behavior on `airexpresshvac.net` still works
- Mail remains unchanged

## Launch Checklist

Phase 1 complete:

- ServiceTitan integration token works
- Intake endpoints accept valid and invalid submissions as expected
- Forms post to the Vercel intake endpoints
- Lead notes include form type, requested service, page URL, timestamp, and schedule preference when relevant

Phase 2 complete:

- Production ServiceTitan credentials are ready
- Vercel domains are attached
- Cloudflare zone is copied with mail records preserved
- Website-only DNS cutover is live
- Redirect rule is in place for `airexpresshvac.net`

Phase 3 complete:

- New Reward worker is active
- Worker origin is the stable production Vercel alias for this project, not the public apex or a preview deployment URL
- Site behavior and mail continuity are unchanged

## Notes

- This runbook intentionally separates form launch from DNS cutover.
- Do not change email routing as part of the website rollout.
- If credentials or platform auth are broken, stop before Phase 2 and fix that first.

## Mail DNS Verification

Before and after the Cloudflare cutover, verify each mail/auth record individually against the pre-cutover zone copy.

Checklist:

- MX records match exactly
- SPF record value matches exactly
- DKIM records match exactly
- Verification TXT records match exactly
- Any other mail/auth TXT or host-specific validation records match exactly
- All mail/auth records remain `DNS only`

Practical verification:

1. Capture the current GoDaddy values before cutover
2. Enter the same values into Cloudflare without changing the record names or targets
3. Compare the record list in Cloudflare line by line against the source zone
4. Recheck after nameserver cutover and again after the site is live

Suggested commands:

```bash
dig mx airexpressutah.com
dig txt airexpressutah.com
dig txt selector1._domainkey.airexpressutah.com
dig txt selector2._domainkey.airexpressutah.com
dig txt airexpresshvac.net
dig txt _dmarc.airexpresshvac.net
dig txt google._domainkey.airexpresshvac.net
npm run verify:email-auth -- --host airexpresshvac.net
```

Use the record names that actually exist in the pre-cutover zone if the DKIM selectors or verification TXT hostnames differ. The goal is an exact record-by-record comparison, not just a working MX lookup.
