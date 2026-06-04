# Air Express Tomorrow Checklist

Use this checklist on launch day to move `airexpressutah.com` onto the prepared Vercel production site without breaking mail.

Date prepared: 2026-04-13
Canonical domain: `https://airexpressutah.com`
Prepared Vercel project: `option-c`
Verified production deployment: `https://option-77ete12ih-vuplicity.vercel.app`

## Goal

By the end of this checklist:

- `airexpressutah.com` serves the Vercel production site
- `www.airexpressutah.com` serves the same site
- contact and estimate forms work in production
- `/admin` works on the live domain
- `airexpresshvac.net` redirects web traffic to `https://airexpressutah.com`
- mail continues working with no record loss

## Ground Rules

- Do not change mail records casually.
- Do not combine DNS cleanup with launch.
- Do not put the New Reward worker in front of the site yet.
- Do not remove any Google Workspace verification or mail-auth records unless you know exactly why.

## Before You Start

Open these in a normal browser:

1. Cloudflare dashboard
2. GoDaddy DNS page for `airexpressutah.com`
3. GoDaddy DNS page for `airexpresshvac.net`
4. Vercel project `option-c`
5. Cloudflare Turnstile widget settings for `airexpressutah.com`

Have this repo available locally:

- `/Users/jamesbrady/Projects/air-express-hvac`

## Phase 1: Build the Cloudflare Zone First

If `airexpressutah.com` is not already created in Cloudflare:

1. Create the zone for `airexpressutah.com`
2. Do not change nameservers yet
3. Go record by record through GoDaddy and recreate the DNS records in Cloudflare

Mail/auth records that must be preserved exactly:

- MX records
- SPF TXT records
- Google verification TXT records
- DKIM records
- any other verification TXT records

Known public baseline for `airexpressutah.com`:

- MX:
  - `1 aspmx.l.google.com`
  - `5 alt1.aspmx.l.google.com`
  - `5 alt2.aspmx.l.google.com`
  - `10 alt3.aspmx.l.google.com`
  - `10 alt4.aspmx.l.google.com`
- TXT on apex:
  - `v=spf1 include:dc-aa8e722993._spfm.airexpressutah.com ~all`
  - `google-site-verification=7Fd9TuTCj7-dsuLK2XMl00vhsd_HH6-QGbzLnM1go40`
- TXT on `dc-aa8e722993._spfm.airexpressutah.com`:
  - `v=spf1 include:_spf.google.com ~all`
- DKIM:
  - preserve the current `google._domainkey` record exactly as shown in GoDaddy

Important:

- Keep mail/auth records as `DNS only` in Cloudflare.
- If you see records in GoDaddy that are not listed above, copy those too.

## Phase 2: Add the Website Records in Cloudflare

Once the zone contents match GoDaddy, add or update only the website hostnames for Vercel:

- `A @ -> 76.76.21.21`
- `A www -> 76.76.21.21`

If Cloudflare already created placeholder web records, replace them with the Vercel values above.

## Phase 2b: Confirm Cloudflare Turnstile Env Vars

Before live form testing, confirm the Vercel production environment has the Cloudflare Turnstile keys:

- `TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

The code also accepts `TURNSTILE_SITEKEY`, `CLOUDFLARE_TURNSTILE_SITE_KEY`, and `CLOUDFLARE_TURNSTILE_SECRET_KEY`.

Do not paste the secret key into tickets, screenshots, terminal logs, or chat. The form should not create a ServiceTitan lead unless the Turnstile token verifies server-side.

## Phase 3: Change Nameservers at GoDaddy

Only after the Cloudflare zone is complete:

1. Copy the two Cloudflare nameservers shown in the Cloudflare zone setup
2. In GoDaddy, change the domain nameservers for `airexpressutah.com` from:
  - `ns27.domaincontrol.com`
  - `ns28.domaincontrol.com`
3. Replace them with the two Cloudflare nameservers
4. Save

Do not change MX or TXT content during the same step.

## Phase 4: Add the Legacy Redirect

For `airexpresshvac.net`, keep mail records intact.

What to change:

- add a web-only redirect so:
  - `https://airexpresshvac.net/*`
  - `https://www.airexpresshvac.net/*`
  redirect to:
  - `https://airexpressutah.com/$1`

This should be done in Cloudflare as a redirect rule, not by deleting the domain’s mail setup.

## Phase 5: Wait for Propagation

Do not assume launch is finished immediately after saving DNS.

What to expect:

- some requests may hit the old site for a short period
- `www` may update before apex, or vice versa
- SSL may take a little time to finish issuing

## Phase 6: Run the Verification From Terminal

Paste this in Terminal:

```bash
cd /Users/jamesbrady/Projects/air-express-hvac && npm run verify:cutover && npm run verify:email-auth -- --host airexpresshvac.net
```

What you should see next:

- `PASS` for nameservers and MX records
- `PASS` for legacy SPF, DMARC, and DKIM
- `PASS` for homepage, contact page, `/admin/`, and OAuth redirect
- `PASS` for legacy redirect

If you still see failures:

- `Homepage` / `Contact page` / `/admin/` / `OAuth redirect` failing means DNS is still pointing at the old site
- `Legacy redirect` failing means `airexpresshvac.net` is still serving the old web setup
- `MX` failing means mail records were not copied correctly
- `SPF` / `DKIM` / `DMARC` failing means customers will keep seeing Gmail sender-verification warnings

## Phase 7: Manual Browser Smoke Test

After the verifier is mostly green, test these manually in a normal browser:

1. `https://airexpressutah.com`
2. `https://www.airexpressutah.com`
3. `https://airexpressutah.com/contact.html`
4. confirm the Cloudflare Turnstile widget renders on the form
5. submit a real contact form test only after explicit approval
6. `https://airexpressutah.com/admin/`
7. confirm GitHub login opens correctly
8. `https://airexpresshvac.net/contact.html`
9. confirm it redirects to `https://airexpressutah.com/contact.html`
10. send a real email from `office@airexpresshvac.net` and confirm Gmail shows `SPF=PASS`, `DKIM=PASS`, and `DMARC=PASS` in “Show original”

## Phase 8: What Not To Touch Tomorrow

Do not do these tomorrow unless the full site is already stable:

- New Reward worker rollout
- DNS cleanup or record pruning
- mail-system changes
- SPF/DKIM redesign
- changing ServiceTitan credentials

## Done Means

You are finished when:

- `npm run verify:cutover` is green or only waiting on minor propagation
- the public site loads on `airexpressutah.com`
- the contact flow works end to end
- `/admin` opens the GitHub auth flow correctly
- `airexpresshvac.net` redirects web traffic
- mail still works

## After Launch

After the site is stable:

1. rotate the GoDaddy password shared in chat
2. rotate the Cloudflare password shared in chat
3. rotate the GitHub OAuth client secret if desired
4. only then plan the New Reward worker rollout
