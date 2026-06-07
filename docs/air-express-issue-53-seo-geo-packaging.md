# Air Express Issue 53 SEO/GEO Packaging Evidence

## Priority Page List

Recorded before implementation on branch `codex/air-express-issue-53-seo-geo-packaging`.

| Page | Reason Selected | Planned Packaging Work |
| --- | --- | --- |
| `ac-repair.html` | High-intent repair query family and calculator seed query context for Lehi/Utah County AC repair. | Add answer-ready AC repair summary, local service links, FAQ markup, and clearer repair-intent internal links. |
| `furnace-repair.html` | High-intent heating repair page for winter emergency demand. | Add answer-ready furnace repair summary, local service links, FAQ markup, and safer emergency language. |
| `emergency.html` | Urgent lead path for no-heat/no-cool searches and phone-first conversion. | Add emergency decision support, local service links, FAQ markup, and clearer phone CTA context. |
| `ac-replacement.html` | High-value replacement intent with calculator package relevance. | Add repair-vs-replace answer block, local service links, FAQ markup, and claim-safe replacement guidance. |
| `service-area-lehi.html` | Canonical home-market city page; current page is thin compared with priority service intent. | Add local service cluster, answer-ready city summary, priority service links, and FAQ markup. |
| `service-area-saratoga-springs.html` | Priority Utah County city page with thin content and existing service-area coverage. | Add local service cluster, answer-ready city summary, priority service links, and FAQ markup. |

## Claim Boundaries

- Do not add new ratings, review counts, rebates, warranties, pricing, financing terms, guarantees, response-time claims, or customer outcomes.
- Existing claims remain outside this issue unless directly touched.
- Link to existing site pages for proof paths and service detail instead of inventing new claim language.
- Production deploy and live verification are not part of this local implementation unless separately approved.

## Verification Targets

- Metadata and canonical links remain valid for all edited pages.
- JSON-LD remains valid JSON and includes page-specific FAQ/Service context where added.
- Existing repo tests and page checks pass before the issue is considered PR-ready.

## Implementation Summary

Completed locally on branch `codex/air-express-issue-53-seo-geo-packaging`.

| Page | Completed Packaging |
| --- | --- |
| `ac-repair.html` | Updated meta/OG/Twitter description, added answer-ready AC repair summary, local service links, visible FAQs, `Service` JSON-LD, and `FAQPage` JSON-LD. |
| `furnace-repair.html` | Updated meta/OG/Twitter description, added answer-ready furnace repair summary, local service links, visible FAQs, `Service` JSON-LD, and `FAQPage` JSON-LD. |
| `emergency.html` | Updated meta/OG/Twitter description, added emergency HVAC decision guidance, local urgent-service links, visible FAQs, `Service` JSON-LD, and `FAQPage` JSON-LD. |
| `ac-replacement.html` | Updated meta/OG/Twitter description, added repair-vs-replacement guidance, local replacement links, visible FAQs, `Service` JSON-LD, and `FAQPage` JSON-LD. Riskier savings/value claims touched in this lane were softened to proof-safe wording. |
| `service-area-lehi.html` | Updated meta/OG/Twitter description, expanded city hub copy, added priority service cluster, visible FAQs, and `@graph` JSON-LD with `LocalBusiness`, `Service`, and `FAQPage`. |
| `service-area-saratoga-springs.html` | Updated meta/OG/Twitter description, expanded city hub copy, added priority service cluster, visible FAQs, and `@graph` JSON-LD with `LocalBusiness`, `Service`, and `FAQPage`. |

Also cleaned extracted headline spacing around deliberate line breaks so text consumers read phrases such as `July, we don't`, `2am? We're`, and `heating & cooling` correctly.

## Verification Results

- PASS: Final-source static SEO/GEO check confirmed each edited page has a production canonical, meta description, `LocalBusiness`, `Service`, and `FAQPage` schema, at least 8 service/city links, and clean extracted H1 spacing.
- PASS: Local HTML href check confirmed no broken local `.html` links on the six edited pages.
- PASS: `git diff --check`.
- PASS: `npm run build:blog && npm run prevercel-build`.
- PASS: Chromium visual/local page check against `http://127.0.0.1:4173` confirmed all six edited pages return HTTP 200 with production canonicals and expected schema types.
- PASS: `npx playwright test --project=chromium-desktop --project=chromium-android --workers=1` returned 27 passed, 3 skipped.
- WARNING: `npm run test:e2e -- --workers=1` returned 33 passed, 3 skipped, 39 failed because Firefox and WebKit browser processes were killed at launch before page interaction (`SIGKILL`, `Killed: 9`, exit code 137). Chromium desktop and Chromium mobile passed. Treat this as a local Playwright browser-runtime blocker, not evidence of edited-page failure.

## Remaining Boundary

- Production deploy and live verification were not performed for this issue.
- The full cross-browser e2e suite still needs a machine/runtime where Firefox and WebKit can launch successfully before recording a completely green all-project Playwright run.
