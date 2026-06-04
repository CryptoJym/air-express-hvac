# Air Express Access Request Packet

Status: prepared only. Not sent.

Last updated: 2026-06-03

Purpose: give James a single owner-safe request packet for the remaining Air
Express blockers. This packet does not ask for passwords, recovery codes,
login codes, raw customer data, payment data, or unrestricted production access.

## Suggested Send Frame

- Sender: Outlook / `James@utlyze.com`, unless James explicitly chooses
  another sender before sending.
- Recipient: Max Harding or the confirmed Air Express/Fearless Rhino access
  owner.
- CC/BCC: none unless James explicitly adds recipients.
- Action: create a draft first or send only after James confirms recipient and
  sender.
- Subject: Air Express access items for tracking, leads, and content

## Short Draft

Hi Max,

We are tightening up the Air Express website, reporting, and content workflow.
The site work is prepared locally, but a few access and proof items are still
blocking clean attribution and distribution.

Can you help with these items?

1. Google Search Console and GA4

Please confirm which Google account owns or can see the Air Express Search
Console property for `airexpressutah.com` and the GA4 property that contains
measurement ID `G-JZ7PY32EVX`.

If `newrewardplatform@gmail.com` is not already added, please add it with the
minimum role needed for read-only reporting. We will use it from inside the New
Reward app session under James's account.

2. Google Business Profile

Please invite `newrewardplatform@gmail.com` as a Manager on the Air Express
Google Business Profile, or confirm which owner account can send that invite.
If ownership recovery is needed, please use Google's owner/manager invitation or
request-access flow. Do not send passwords or recovery codes.

3. Google Tag Manager

If Air Express has a Google Tag Manager container, please send the container ID
only, for example `GTM-XXXXXXX`, or a screenshot showing the Air Express
container name and ID. We should not add a GTM snippet until the exact container
is verified.

4. ServiceTitan lead history

Please provide a redacted ServiceTitan lead export or screenshot packet for Air
Express website leads. We only need reporting fields:

- lead ID
- created date
- source or campaign
- service category
- lead status
- booked job ID if available
- sold or revenue marker if approved

Please remove customer names, phone numbers, email addresses, street addresses,
private notes, and payment details.

5. Website delivery approval

The local Air Express source now includes the approved GA4 tag and lead event
source, but the live website still does not serve `/analytics.js`. Please
confirm the approved delivery path for the next site sync: New Reward edge sync,
Vercel/GitHub App connection, or a manual deploy path.

6. Social distribution access

For the first three seasonal posts, please add New Reward with the minimum role
needed to draft or schedule posts on one or two approved channels, starting with
Facebook and Google Business Profile if those are the right channels.

7. Case-study proof

Please send 2-3 recent job examples we can turn into approved case-study style
content. A few bullets are enough: customer problem, city or service area,
diagnosis, work completed, outcome, approved photos, testimonial permission, and
redacted ServiceTitan/source notes if available.

We will keep everything in review mode until you approve it. Nothing public
needs to go live until the access and delivery path are confirmed.

Thanks,
James

## Internal Status Map

| Blocker | Current proof | Needed from owner |
|---|---|---|
| GSC history | Local Google token is for `newrewardplatform@gmail.com` but lacks `webmasters.readonly`; New Reward setup shows GSC not connected. | Property access or owner-led invite plus approved read-only reconnect. |
| GA4 history | Local source uses `G-JZ7PY32EVX`, but provider history pull lacks `analytics.readonly` and New Reward setup shows GA4 not connected. | GA4 property visibility for `newrewardplatform@gmail.com` and approved read-only reconnect. |
| GBP | Later notes say GSC/GA4 were live but GBP was not connected; public-owner trail points to Max as strongest recovery lead. | GBP Manager invitation or owner recovery path. |
| GTM | Repo and bounded Gmail searches found no Air Express `GTM-...` container ID. | Container ID or owner/provider screenshot if GTM is actually used. |
| Live GA4 source | Local public page coverage is `120/120`, but production `/analytics.js` is 404 and live homepage has no GA4/GTM marker. `data/owned-site-delivery-sync-check.json` records homepage and `analytics.js` as `pending_delivery_sync`. | Approved delivery path and post-sync verification. |
| ServiceTitan history | Prior proof shows five website leads on 2026-04-24 and two listed lead IDs under campaign `80365413`; local env has no export credentials. | Redacted export/API access or screenshot packet by date/source/campaign/status. |
| Social posting | Facebook URL and GBP review link exist; admin access not verified. | Platform invitations, not passwords. |
| Case studies | Draft request exists; no approved job stories yet. | Redacted owner-approved job examples and photo/testimonial permissions. |

## Boundaries

- Do not request or store passwords, recovery codes, login codes, raw private
  customer notes, payment data, or unrestricted provider tokens.
- Do not perform Google, ServiceTitan, Cloudflare, DNS, Vercel, Turnstile, GTM,
  CRM, public post, public send, or production deployment actions from this
  packet without explicit approval.
- Treat sent, drafted, approved, deployed, live, and verified as separate
  states.
