# Air Express HVAC Agent Transfer Packet

Workspace: `/Users/jamesbrady/Projects/air-express-hvac`

Goal: maintain the Air Express website and New Reward onboarding/control hub
without disrupting production launch surfaces.

Start files:

- `AGENTS.md`
- `/Users/jamesbrady/Projects/AGENTS.md`
- `README.md`
- `docs/onboarding-gap-map.md`
- `docs/source-evidence-map.md`
- `docs/account-setup-handoff.md`
- `docs/air-express-launch-runbook.md`
- `docs/air-express-tomorrow-checklist.md`
- `pages/index.html`
- `pages/roadmap-performance.html`
- `pages/issue-24-30-blocker-report.html`
- `pages/content-readiness-report.html`
- `pages/seo-geo-attribution-report.html`
- `pages/new-reward-impact-report.html`
- `data/issue-24-30-completion-audit.csv`
- `data/issue-24-30-acceptance-criteria-audit.csv`
- `data/issue-evidence-alignment-check.json`
- `data/air-express-evidence-refresh-status.json`
- `data/newreward-cross-repo-evidence.csv`
- `data/attribution-email-evidence.csv`
- `data/public-scan-agent-manifest.json`
- `data/google-history/history-pull-status.json`
- `data/newreward-air-express-provider-readonly-recheck.json`
- `data/live-measurement-path-check.json`
- `data/owned-site-delivery-sync-check.json`
- `data/site-file-manifest.json`
- `data/public-claim-register.json`
- `data/servicetitan-export-access-check.json`
- `data/servicetitan-redacted-export-template.csv`
- `data/servicetitan-redacted-export-import-status.json`
- `docs/gsc-ga4-history-and-impact-plan.md`
- `docs/air-express-newreward-mapping-reconciliation-packet.md`
- `docs/air-express-google-readonly-reconnect-packet.md`
- `docs/air-express-access-request-packet.md`
- `docs/air-express-owned-site-delivery-sync-packet.md`
- `docs/air-express-servicetitan-redacted-export-import.md`
- `docs/air-express-content-briefs.md`
- `docs/air-express-blog-distribution-schedule.md`
- `docs/max-social-access-request-draft.md`
- `docs/max-case-study-outreach-draft.md`
- `output/hermes-seo-geo-audit/audit-run-packet.json`
- `output/hermes-seo-geo-audit/audit-run-prompt.md`
- `output/hermes-seo-geo-audit/latest-brief.md`

Boundaries:

- No secrets in files or chat.
- No DNS, Vercel, Cloudflare, ServiceTitan, Turnstile, OAuth, email, public
  profile, external send, paid signup, or production deploy mutations without
  explicit approval in the active thread.
- Treat the worktree as shared and dirty. Preserve unrelated changes.
- Distinguish verified, inferred, prepared, blocked, and not attempted.

Current verified facts from 2026-06-03:

- `airexpressutah.com` resolves through Cloudflare nameservers
  `romina.ns.cloudflare.com` and `yisroel.ns.cloudflare.com`.
- `airexpressutah.com` and `www.airexpressutah.com` return HTTP 200.
- `airexpresshvac.net` redirects to `https://airexpressutah.com/`.
- Live HTTP responses include `x-newrewards-edge-active-version` and related
  New Rewards edge headers.
- Live edge responses report website id `cmorqbs9j001r5nr1h25vosp8`.
- Public `/robots.txt`, `/llms.txt`, and `/sitemap.xml` load from the New
  Reward edge, but production `/analytics.js` returns HTTP 404 and the live
  homepage does not expose `G-JZ7PY32EVX` or GA4/GTM markers.
- Authenticated New Reward admin access reaches
  `/admin/crm/cmmwe8so000077kqptwysqaem/setup`; setup is now `4/5` and using a
  local setup snapshot because Search Console, GA4, Google Business Profile,
  and Google Business Profile sync failed to load.
- James clarified that New Reward app/control-plane access should be under
  `james@jamesbrady.org`; `newrewardplatform@gmail.com` is the Google provider
  account to connect from inside that app session.
- GSC, GA4, and GBP remain `NOT CONNECTED` in the New Reward integration
  snapshot.
- New Reward settings confirms `https://airexpressutah.com` as the client
  website, but website delivery shows `Owned-site content = MANUAL_REQUIRED`,
  `GitHub App = NOT CONNECTED`, and `Vercel = MISSING`.
- New Reward SEO workspace opens at
  `/admin/crm/cmmwe8so000077kqptwysqaem/seo-optimization`, but reports
  `Client not found: cmmwe8so000077kqptwysqaem`.
- `/admin/` returns HTTP 200.
- `/api/auth` returns HTTP 500 because `OAUTH_GITHUB_CLIENT_ID` is not set in
  the live Vercel environment.
- `npm run verify:cutover` fails only on legacy DKIM and OAuth redirect.
- `npm run verify:email-auth -- --host airexpresshvac.net` fails on DKIM.
- `npm run audit:seo-geo-attribution` regenerated
  `data/seo-geo-attribution-audit.json` and
  `pages/seo-geo-attribution-report.html`; scores are technical `100`, GEO
  `90`, messaging `100`, attribution `25`, accessibility `100`.
- `npm run pull:gsc-ga4-history` generated
  `data/google-history/history-pull-status.json` and
  `pages/new-reward-impact-report.html`; the active
  `newrewardplatform@gmail.com` token is present but blocked by missing
  `webmasters.readonly`, `analytics.readonly`, and `business.manage` scopes.
  The report now models Google Business Profile explicitly and includes a
  sanitized token scope inventory instead of leaving GBP or token state as
  implicit unpulled surfaces.
- `npm run verify:newreward-mapping` refreshes sanitized New Reward source
  mapping evidence through `psql` with `BEGIN READ ONLY` and writes
  `data/newreward-air-express-provider-readonly-recheck.json`; the latest
  status is `rows_found`. A configured NewRewards production env source now
  returns Air Express client `cmmwe8so000077kqptwysqaem`, tenant
  `cmmwe8ri500007kqpd05kb4e5`, primary website
  `cmorqbs9j001r5nr1h25vosp8` matching the live edge website id, expired GSC
  rows for `sc-domain:airexpressutah.com`, expired GA4 rows with
  `propertyId = null`, and valid Cloudflare rows. No DB URL, token, encrypted
  credential blob, provider token, raw provider payload, or customer data is
  stored.
- The #26 mapping handoff is
  `docs/air-express-newreward-mapping-reconciliation-packet.md`; it now records
  the canonical website proof plus the remaining SEO workspace UI/provider
  reconnect gates.
- The prepared Google read-only reconnect handoff for #27/#29 is
  `docs/air-express-google-readonly-reconnect-packet.md`; it lists required
  scopes, preconditions, stop gates, pull commands, expected output files, and
  issue close criteria. It has not been executed and no OAuth consent was
  submitted.
- The Air Express Hermes SEO/GEO audit packet is ready at
  `output/hermes-seo-geo-audit/audit-run-prompt.md` with competitor mode
  `hybrid` and automatic competitor selection enabled.
- The content brief matrix is available at `data/content-briefs.csv` with 10
  briefs, proof gates, internal links, and attribution plans; the readable
  summary is `docs/air-express-content-briefs.md`. The weekly distribution
  schedule is `docs/air-express-blog-distribution-schedule.md`, and the Max
  social-access and case-study outreach drafts are prepared locally without
  being sent. The consolidated owner-safe access request packet is
  `docs/air-express-access-request-packet.md`; it covers GSC, GA4, GBP, GTM,
  ServiceTitan export/history, live delivery approval, social access, and
  case-study proof.
- The issue 24-30 completion matrix is available at
  `data/issue-24-30-completion-audit.csv` and
  `pages/issue-24-30-blocker-report.html`; #25 is complete, while #24 and
  #26-#30 remain open pending mapping, Google read scopes, live delivery sync,
  and ServiceTitan export proof.
- The criterion-level closeout audit is available at
  `data/issue-24-30-acceptance-criteria-audit.csv`; it maps every acceptance
  criterion from #24-#30 to evidence, blocker, next action, and closure-ready
  state.
- Cross-repo New Reward context is recorded at
  `data/newreward-cross-repo-evidence.csv`; it preserves the Air Express vault
  record, NewRewards #2876/#2880 paid-run state, NewRewards #3384/#3429
  platform provider-state context, and NewRewards #3834 resolver closeout
  without treating any of those as proof of Air Express GSC/GA4/GBP access.
- `npm run verify:live-measurement` writes
  `data/live-measurement-path-check.json`; current status is
  `fixed_locally_pending_live`, with local `index.html` and `analytics.js`
  containing `G-JZ7PY32EVX`, no approved GTM container found, and live
  homepage/`/analytics.js` still missing the measurement marker.
- `npm run verify:owned-site-delivery-sync` writes
  `data/owned-site-delivery-sync-check.json`; current status is
  `pending_delivery_sync`. Local `index.html` and `analytics.js` are prepared,
  live homepage and `/analytics.js` are still missing the critical measurement
  artifact, and live `llms.txt`, `sitemap.xml`, and `robots.txt` differ from
  the repo-local files or are edge-managed.
- `npm run prepare:delivery-sync-packet` writes
  `docs/air-express-owned-site-delivery-sync-packet.md`; current packet lists
  P0 homepage and `analytics.js` sync requirements, noncritical `llms.txt`,
  sitemap, and robots drift, the prepared blog URL that is local but not live,
  stop gates, and post-sync verification commands for #28.
- `npm run verify:site-file-manifest` writes
  `data/site-file-manifest.json`; current status is `passed`. It verifies
  required publish artifacts, sitemap/local HTML coverage, generated blog
  outputs, draft exclusion, and local static references before any deploy or
  edge sync.
- `npm run verify:public-claims` writes
  `data/public-claim-register.json`; current status is `passed`. Current local
  source no longer claims BBB accreditation and instead uses `BBB Business
  Profile`; review/rating, response-time, financing, license, certification,
  and manufacturer/dealer claims remain registered as proof-gated.
- Sanitized mailbox evidence is captured in
  `data/attribution-email-evidence.csv`; it preserves message ids and findings
  without passwords, verification codes, recovery codes, or token material.
- `npm run verify:servicetitan-export` writes
  `data/servicetitan-export-access-check.json`; current status is
  `blocked_env` because required ServiceTitan env vars are absent from process
  env, the Air Express repo env files, `~/.config/newrewards/.env`, and
  `~/.env`. The diagnostic stores only key presence, sanitized errors, and the
  approved export-packet schema, not credential values, tokens, customer PII, or
  raw lead payloads. `data/servicetitan-prior-proof-summary.csv` also preserves
  the prior count-only five-lead guide evidence without private customer data.
- `npm run import:servicetitan-redacted-export` writes
  `data/servicetitan-redacted-export-template.csv` and
  `data/servicetitan-redacted-export-import-status.json`; current status is
  `awaiting_input`. If an approved redacted CSV is supplied later, the command
  rejects PII columns/values and writes only safe lead id, date, campaign/source,
  service category, status, optional booking id, and approved sold/revenue
  marker fields. No ServiceTitan API call, CRM mutation, live test lead, Drive
  mutation, or production change occurs.
- `npm run test:servicetitan-redacted-import` verifies the redacted
  ServiceTitan import path: awaiting-input status, safe alias normalization, and
  PII column/value rejection without persisting raw private values.
- `npm run refresh:air-express-evidence` runs the safe repo-local refresh
  sequence for blog build, site-file manifest, public claims, live measurement,
  owned-site delivery sync, delivery packet, New Reward mapping, Google history,
  ServiceTitan export readiness, content readiness, issue alignment, blocker
  report, SEO/GEO audit, and final onboarding evidence. It writes
  `data/air-express-evidence-refresh-status.json` and performs no provider,
  deploy, OAuth, ServiceTitan, public-send, public-post, or production
  mutations.

Recommended next action:

1. Repair the New Reward internal mapping first: map CRM client
   `cmmwe8so000077kqptwysqaem` to the SEO workspace/client record and canonical
   website id that serves live edge `cmorqbs9j001r5nr1h25vosp8`.
   Start from `docs/air-express-newreward-mapping-reconciliation-packet.md`.
2. Wire owned-site delivery by connecting GitHub App and Vercel, or record an
   approved manual sync path, before expecting repo-local `/analytics.js`,
   `llms.txt`, or sitemap changes to reach production.
3. Only after mapping and delivery are clean, sign into New Reward as
   `james@jamesbrady.org`, then reconnect GSC/GA4/GBP by selecting
   `newrewardplatform@gmail.com` as the Google provider account that can see
   `airexpressutah.com`, the GA4 property containing `G-JZ7PY32EVX`, and the
   Air Express Google Business Profile location. Start from
   `docs/air-express-google-readonly-reconnect-packet.md`.
4. If the direct Google API history pull is approved, run the read-only ADC
   re-auth in `docs/gsc-ga4-history-and-impact-plan.md`, then rerun
   `npm run pull:gsc-ga4-history`.
5. Fix the Vercel OAuth env var gap for Decap CMS only after provider access is
   confirmed, and verify or repair legacy DKIM with mail owner approval.
6. If Max or ServiceTitan supplies a redacted lead export, run
   `npm run test:servicetitan-redacted-import`, then
   `npm run import:servicetitan-redacted-export -- --input <csv>`, then rerun
   `npm run pull:gsc-ga4-history` and `npm run verify:onboarding-evidence`.
7. Rerun `npm run verify:public-claims` after any trust-badge, ratings,
   response-time, financing, license, certification, or dealer-status copy
   changes.
8. After refreshing issue matrices or diagnostic JSON, run
   `npm run verify:issue-evidence-alignment` to confirm the #24-#30 issue
   matrix still matches the current live-measurement, delivery, Google history,
   New Reward mapping, and ServiceTitan diagnostic files.
   For a full safe refresh, run `npm run refresh:air-express-evidence` instead.
9. After refreshing issue matrices or diagnostic JSON, run
   `npm run build:issue-blocker-report` so
   `pages/issue-24-30-blocker-report.html` stays aligned with current blocker
   evidence.
10. After changing content briefs, blog draft flags, distribution rows, or Max
   outreach drafts, run `npm run build:content-readiness-report` so
   `pages/content-readiness-report.html` stays aligned with the separate #31
   content lane.
11. Before any approved owned-site delivery, run
   `npm run prepare:delivery-sync-packet` and follow
   `docs/air-express-owned-site-delivery-sync-packet.md`; do not add a GTM
   container unless the approved Air Express container id is verified.
12. Run the prepared Hermes SEO/GEO audit prompt if a fresh read-only competitor
   comparison and visibility/trust readout is needed.

Return format for future onboarding/status passes:

- Status
- Files read
- Files changed
- What was verified
- What was prepared
- Blockers / onboarding needs
- Verification run
- Recommended next action
