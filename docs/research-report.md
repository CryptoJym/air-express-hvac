# Air Express Onboarding Research Report

Date: 2026-06-01

## TL;DR

Air Express has moved beyond the April launch plan: the canonical site is live
on Cloudflare, the legacy `.net` web domain redirects to `.com`, and New Rewards
edge headers are already active. The control problem is now access, proof, and
measurement rather than initial launch prep.

The highest-leverage next moves are:

1. Confirm provider ownership and access for Vercel, Cloudflare, ServiceTitan,
   Turnstile, GitHub OAuth, Google Business Profile, Search Console, GA4, and
   Resend.
2. Fix the Decap CMS OAuth live env var gap after Vercel access is confirmed.
3. Verify or repair legacy-domain DKIM without changing mail routing.
4. Reconcile public local/listing data before creating new profiles, because
   existing profiles and possible stale NAP variants already appear.
5. Establish weekly measurement using the repo ledgers and the static roadmap
   page.

## Existing Assets

- Canonical website: `https://airexpressutah.com`
- Legacy web domain: `https://airexpresshvac.net`
- CMS/admin: Decap CMS at `/admin/`, GitHub backend, self-hosted Vercel OAuth.
- Repo: `CryptoJym/air-express-hvac` per `admin/config.yml`.
- CRM/intake: ServiceTitan lead-first intake layer.
- Abuse protection: Cloudflare Turnstile server-side validation in code path.
- Edge: live responses show New Rewards edge headers.
- Social: Facebook profile link exists in site footers.
- Review/local: Google review link exists in site footers.
- Public local/listing surfaces found: Angi, MapQuest, ContractorsUp, Cylex,
  Manta, Lehi business license list.

## Access State

Owned or verified live:

- Site loads on canonical domain.
- Legacy web redirect works.
- Cloudflare nameservers are active.
- New Rewards edge headers are present.
- `/admin/` loads.

Access/control unknown:

- Cloudflare dashboard and DNS zone.
- Vercel project `option-c`.
- ServiceTitan tenant and campaign settings.
- Turnstile widget/settings.
- GitHub OAuth app and Vercel OAuth env vars.
- Google Business Profile.
- Search Console and GA4.
- Resend sender/domain settings.
- Facebook and other social accounts.
- Third-party listings and directories.

Blocked:

- Decap CMS login flow is blocked by missing live
  `OAUTH_GITHUB_CLIENT_ID`.
- Legacy DKIM verification is blocked until mail DNS/source selectors are
  confirmed.
- Public profile claiming/repair is blocked on owner authorization and
  duplicate checks.

## Industry Distribution Map

P0 surfaces:

- Owned site and CMS.
- ServiceTitan forms and lead visibility.
- Google Business Profile, Google reviews, Search Console, GA4.
- Cloudflare/Vercel/DNS/Turnstile provider control.
- Email authentication and sender identity.
- Baseline search/local/AI query tracking.

P1 surfaces:

- Apple Business Connect.
- Bing Places.
- MapQuest/Yext repair or control.
- BBB profile/access.
- Facebook access and approved owned-URL distribution.
- Nextdoor Business Page.
- Lehi/local chamber or municipal proof surfaces.
- Angi profile monitoring/repair strategy.

P2 surfaces:

- Houzz, Thumbtack, Yelp, manufacturer/dealer locators, supplier/financing
  partner pages, project galleries, and referral/co-marketing lanes after P0/P1
  control is stable.

Excluded for now:

- Paid listing upgrades.
- Public posts.
- Review campaigns beyond approved Google-review-safe flows.
- New profile creation when an existing listing may already exist.
- Provider verification submissions without owner/legal proof.

## Risks

- The launch runbook is stale for DNS/edge state. It still contains useful
  safety guidance, but current state must be checked before any launch claim.
- The New Rewards worker appears active; if this was not intentionally approved,
  it needs immediate owner review.
- `/api/auth` returning 500 blocks CMS login.
- Missing DKIM on `airexpresshvac.net` may affect mail trust or warnings.
- Public listing NAP data varies: MapQuest shows a phone number different from
  the site phone, and some directories may reflect stale scraped data.
- Public review surfaces can create reputational risk; do not solicit or reply
  without approved policy and owner access.

## 80/20 Recommendation

The 80/20 is not more content. It is access/control and proof:

1. Establish provider access and owner map.
2. Fix the two verified live blockers: Decap OAuth env var and legacy DKIM.
3. Reconcile public NAP/profile accuracy across Google, Apple, Bing, MapQuest,
   BBB, Facebook, and high-fit HVAC/local directories.
4. Track performance weekly with stable benchmark queries and proof states.
