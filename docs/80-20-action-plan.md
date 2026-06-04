# Air Express 80/20 Action Plan

Date: 2026-06-01

## P0: Control And Proof

1. Provider access ledger
   - Current state: prepared in `data/channel-access-status.csv`.
   - First action: James confirms who can access Vercel, Cloudflare,
     ServiceTitan, Turnstile, Google Business Profile, GitHub OAuth, Search
     Console, GA4, Resend, and Facebook.
   - Proof: dashboard screenshot or owner confirmation without secret values.
   - Blocker: no provider mutation approval in this thread.

2. Decap CMS OAuth repair
   - Current state: `/admin/` loads, `/api/auth` returns 500.
   - First action: after Vercel access is confirmed, add/repair
     `OAUTH_GITHUB_CLIENT_ID` and confirm the matching secret and callback URL.
   - Proof: `/api/auth` returns 302 to GitHub OAuth with canonical callback.
   - Blocker: Vercel env var mutation requires approval.

3. Mail-auth continuity
   - Current state: legacy `.net` MX/SPF/DMARC pass; DKIM selector check fails.
   - First action: identify actual DKIM selector from mail provider/source DNS.
   - Proof: `npm run verify:email-auth -- --host airexpresshvac.net` passes or
     records the exact intended selector.
   - Blocker: mail DNS edits require approval and owner proof.

4. ServiceTitan lead visibility
   - Current state: prior guide shows successful lead creation on 2026-04-24.
   - First action: request current ServiceTitan access/screenshot for lead view
     and campaign `80365413`.
   - Proof: latest approved form test appears under the intended lead view.
   - Blocker: do not submit live forms or mutate CRM without approval.

5. Current launch-state reconciliation
   - Current state: Cloudflare, redirect, and New Rewards edge are live.
   - First action: James confirms whether New Rewards edge state is intended.
   - Proof: owner-approved status in docs or tracker.
   - Blocker: live edge rollback/change is a production mutation.

## P1: Distribution Foundation

1. Google Business Profile and reviews
   - Verify owner/admin access.
   - Confirm NAP, services, URL, hours, photos, and review link.
   - Track review-safe ask flow only after approval.

2. Apple/Bing/MapQuest/local profiles
   - Search first, claim existing before creating.
   - Fix NAP drift and duplicate/stale listings through official channels.
   - Stop at phone, document, postcard, or paid gates.

3. Facebook/direct social
   - Verify Facebook page access.
   - Confirm Instagram, YouTube, TikTok, LinkedIn, and Nextdoor presence before
     creating anything.
   - Distribute only approved owned URLs.

4. HVAC/local-service directories
   - Prioritize BBB, MapQuest/Yext, Angi monitoring/repair, local chamber or
     municipal proof, manufacturer/dealer locators, and supplier/financing
     partner pages.
   - Deprioritize generic directories unless they already rank or show NAP
     drift.

## P2: Expansion

1. Project/photo proof library for owned pages and visual profiles.
2. Service-area and seasonal content distribution with UTM conventions.
3. Partner/referral list after core profiles and measurement are stable.
4. Paid placement tests only with explicit budget approval.

## Weekly Rhythm

Every week:

- Update `data/weekly-scorecard.csv`.
- Run non-mutating verification where appropriate.
- Check benchmark queries in `data/benchmark-queries.csv`.
- Move distribution rows from planned to approved, published, indexed,
  distributed, measured, or blocked based on proof.
- Keep provider mutations separate from research and documentation.
