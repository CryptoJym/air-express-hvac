# Air Express HVAC Control Hub

This repository is the Air Express HVAC website and New Reward onboarding
control hub.

Current verified operating state as of 2026-06-03:

- Canonical site: `https://airexpressutah.com`
- Legacy web domain: `https://airexpresshvac.net` redirects to the canonical
  site.
- Cloudflare nameservers are active for `airexpressutah.com`.
- New Rewards edge headers are present on the live canonical site.
- `/admin/` loads, but `/api/auth` returns HTTP 500 because the live OAuth
  client ID is missing.
- GSC/GA4/GBP attribution remains blocked by expired New Reward GSC/GA4
  provider rows, missing Google read scopes/property or location proof, and live
  delivery gaps, not by proof that the Google assets do not exist.
- Reconnect identity model: New Reward app/control-plane access should run
  under `james@jamesbrady.org`; Google provider OAuth should use
  `newrewardplatform@gmail.com` from inside that app session.
- The SEO/GEO attribution report is refreshed locally at
  [pages/seo-geo-attribution-report.html](pages/seo-geo-attribution-report.html).
  Current scores are technical `100`, GEO `90`, messaging `100`, attribution
  `25`, and accessibility `100`.
- The New Reward impact report and GSC/GA4 pull status are refreshed locally at
  [pages/new-reward-impact-report.html](pages/new-reward-impact-report.html)
  and [data/google-history/history-pull-status.json](data/google-history/history-pull-status.json).
  The pull status now records GSC, GA4, and Google Business Profile blockers;
  the current token scope inventory contains cloud/admin scopes but lacks
  `webmasters.readonly`, `analytics.readonly`, and `business.manage`.
- The issue 24-30 blocker report is refreshed locally at
  [pages/issue-24-30-blocker-report.html](pages/issue-24-30-blocker-report.html).
  The criterion-level closeout audit is recorded at
  [data/issue-24-30-acceptance-criteria-audit.csv](data/issue-24-30-acceptance-criteria-audit.csv).
- The safe end-to-end evidence refresh command is
  `npm run refresh:air-express-evidence`. It refreshes repo-local diagnostics,
  reports, and issue-alignment evidence without provider, deploy, OAuth,
  ServiceTitan, public-send, public-post, or production mutations. The latest
  refresh status is recorded at
  [data/air-express-evidence-refresh-status.json](data/air-express-evidence-refresh-status.json).
- Cross-repo New Reward context is recorded at
  [data/newreward-cross-repo-evidence.csv](data/newreward-cross-repo-evidence.csv).
  It separates Air Express client activation/source-state, paid-run, platform
  attribution, and resolver evidence from the current attribution blockers and
  confirms that the #25 resolver repair is not the remaining gate.
- The live GA4/GTM measurement path is checked locally at
  [data/live-measurement-path-check.json](data/live-measurement-path-check.json);
  current status is `fixed_locally_pending_live`, with local public page
  coverage `120/120`, local GA4 present, no approved GTM container id found,
  and live homepage/`/analytics.js` still missing the marker.
- Owned-site delivery sync is checked locally at
  [data/owned-site-delivery-sync-check.json](data/owned-site-delivery-sync-check.json);
  current status is `pending_delivery_sync`. Local `index.html` and
  `analytics.js` contain the approved GA4 source, while live
  `https://airexpressutah.com/` and `/analytics.js` still need an approved
  deploy, New Reward edge sync, or manual artifact sync.
- The owned-site delivery handoff packet is prepared at
  [docs/air-express-owned-site-delivery-sync-packet.md](docs/air-express-owned-site-delivery-sync-packet.md).
  It lists the P0 homepage and `analytics.js` sync requirements, noncritical
  `llms.txt`/sitemap/robots drift, the prepared blog URL that is local but not
  live, stop gates, and post-sync verification commands for #28.
- Local site-file completeness is checked at
  [data/site-file-manifest.json](data/site-file-manifest.json); current status
  is `passed`. It verifies required publish artifacts, sitemap/local HTML
  coverage, draft blog exclusion, generated post presence, and local static
  references before any deploy or edge sync.
- Public trust and marketing claims are checked locally at
  [data/public-claim-register.json](data/public-claim-register.json); current
  status is `passed`. Unsupported BBB accreditation wording was replaced with
  `BBB Business Profile`, and review, response-time, financing, licensing,
  certification, and dealer-status claims remain proof-gated until current
  owner or provider evidence is supplied.
- Sanitized mailbox evidence for attribution, ServiceTitan, and GTM-source
  checks is recorded at
  [data/attribution-email-evidence.csv](data/attribution-email-evidence.csv).
- The consolidated owner-safe access request packet is prepared at
  [docs/air-express-access-request-packet.md](docs/air-express-access-request-packet.md).
  It has not been sent.
- The New Reward mapping reconciliation packet for #26/#27/#29 is current at
  [docs/air-express-newreward-mapping-reconciliation-packet.md](docs/air-express-newreward-mapping-reconciliation-packet.md).
  It now records the rows-found canonical website proof and the expired
  provider-row blocker.
- The Google read-only reconnect packet for #27/#29 is prepared at
  [docs/air-express-google-readonly-reconnect-packet.md](docs/air-express-google-readonly-reconnect-packet.md).
  It has not been executed and no OAuth consent was submitted.
- ServiceTitan export readiness is checked locally at
  [data/servicetitan-export-access-check.json](data/servicetitan-export-access-check.json);
  current status is `blocked_env`, with no credential values, tokens, or
  customer PII stored.
- The redacted ServiceTitan export import path is prepared at
  [docs/air-express-servicetitan-redacted-export-import.md](docs/air-express-servicetitan-redacted-export-import.md),
  with template
  [data/servicetitan-redacted-export-template.csv](data/servicetitan-redacted-export-template.csv)
  and current import status
  [data/servicetitan-redacted-export-import-status.json](data/servicetitan-redacted-export-import-status.json).
  Current status is `awaiting_input`; no ServiceTitan API call or CRM mutation
  occurred.
- ServiceTitan lead handling, Decap CMS OAuth, Turnstile, Vercel, Cloudflare,
  DNS, and mail continuity are production-impacting surfaces. Do not mutate
  those providers without explicit approval in the active thread.

Primary onboarding docs:

- [docs/onboarding-gap-map.md](docs/onboarding-gap-map.md)
- [docs/source-evidence-map.md](docs/source-evidence-map.md)
- [docs/research-report.md](docs/research-report.md)
- [docs/80-20-action-plan.md](docs/80-20-action-plan.md)
- [docs/account-setup-handoff.md](docs/account-setup-handoff.md)
- [docs/gsc-ga4-history-and-impact-plan.md](docs/gsc-ga4-history-and-impact-plan.md)
- [docs/air-express-owned-site-delivery-sync-packet.md](docs/air-express-owned-site-delivery-sync-packet.md)
- [docs/air-express-content-briefs.md](docs/air-express-content-briefs.md)
- [docs/air-express-blog-distribution-schedule.md](docs/air-express-blog-distribution-schedule.md)
- [docs/air-express-servicetitan-redacted-export-import.md](docs/air-express-servicetitan-redacted-export-import.md)
- [docs/max-social-access-request-draft.md](docs/max-social-access-request-draft.md)
- [docs/max-case-study-outreach-draft.md](docs/max-case-study-outreach-draft.md)
- [docs/issue-board-seed.md](docs/issue-board-seed.md)
- [pages/index.html](pages/index.html)
- [pages/roadmap-performance.html](pages/roadmap-performance.html)
- [pages/issue-24-30-blocker-report.html](pages/issue-24-30-blocker-report.html)
- [pages/content-readiness-report.html](pages/content-readiness-report.html)
- [pages/seo-geo-attribution-report.html](pages/seo-geo-attribution-report.html)

Operational ledgers:

- [data/channel-access-status.csv](data/channel-access-status.csv)
- [data/distribution-ledger.csv](data/distribution-ledger.csv)
- [data/benchmark-queries.csv](data/benchmark-queries.csv)
- [data/weekly-scorecard.csv](data/weekly-scorecard.csv)
- [data/google-auth-scope-audit.csv](data/google-auth-scope-audit.csv)
- [data/attribution-work-items.csv](data/attribution-work-items.csv)
- [data/attribution-email-evidence.csv](data/attribution-email-evidence.csv)
- [data/content-briefs.csv](data/content-briefs.csv)
- [data/issue-24-30-completion-audit.csv](data/issue-24-30-completion-audit.csv)
- [data/issue-24-30-acceptance-criteria-audit.csv](data/issue-24-30-acceptance-criteria-audit.csv)
- [data/issue-evidence-alignment-check.json](data/issue-evidence-alignment-check.json)
- [data/air-express-evidence-refresh-status.json](data/air-express-evidence-refresh-status.json)
- [data/newreward-cross-repo-evidence.csv](data/newreward-cross-repo-evidence.csv)
- [data/google-history/history-pull-status.json](data/google-history/history-pull-status.json)
- [data/newreward-air-express-provider-readonly-recheck.json](data/newreward-air-express-provider-readonly-recheck.json)
- [data/live-measurement-path-check.json](data/live-measurement-path-check.json)
- [data/owned-site-delivery-sync-check.json](data/owned-site-delivery-sync-check.json)
- [data/site-file-manifest.json](data/site-file-manifest.json)
- [data/public-claim-register.json](data/public-claim-register.json)
- [data/servicetitan-export-access-check.json](data/servicetitan-export-access-check.json)
- [data/servicetitan-redacted-export-template.csv](data/servicetitan-redacted-export-template.csv)
- [data/servicetitan-redacted-export-import-status.json](data/servicetitan-redacted-export-import-status.json)
- [data/public-scan-agent-manifest.json](data/public-scan-agent-manifest.json)
- [output/hermes-seo-geo-audit/audit-run-packet.json](output/hermes-seo-geo-audit/audit-run-packet.json)
- [output/hermes-seo-geo-audit/audit-run-prompt.md](output/hermes-seo-geo-audit/audit-run-prompt.md)
- [output/hermes-seo-geo-audit/latest-brief.md](output/hermes-seo-geo-audit/latest-brief.md)

Launch references:

- [docs/air-express-launch-runbook.md](docs/air-express-launch-runbook.md)
- [docs/air-express-tomorrow-checklist.md](docs/air-express-tomorrow-checklist.md)

Status labels used in onboarding artifacts:

- `verified`: directly checked from repo, DNS, HTTP, tests, or public source.
- `inferred`: supported by local evidence but not directly dashboard-verified.
- `prepared`: ready for an approved owner/provider action.
- `blocked`: cannot move without account access, provider state, client proof,
  or explicit approval.
- `not_attempted`: intentionally not checked or changed in this pass.

Useful local verification commands:

- `npm run verify:onboarding-evidence`
- `npm run refresh:air-express-evidence`
- `npm run verify:newreward-mapping`
- `npm run verify:live-measurement`
- `npm run verify:owned-site-delivery-sync`
- `npm run verify:site-file-manifest`
- `npm run verify:public-claims`
- `npm run verify:servicetitan-export`
- `npm run verify:issue-evidence-alignment`
- `npm run test:servicetitan-redacted-import`
- `npm run build:issue-blocker-report`
- `npm run build:content-readiness-report`
- `npm run prepare:delivery-sync-packet`
- `npm run import:servicetitan-redacted-export`
- `npm run pull:gsc-ga4-history`
- `npm run audit:seo-geo-attribution`
