## TL;DR

- Build a subagent-ready Air Express blog/content backlog that supports SEO,
  GEO, and future attribution reporting.
- Prioritize proof-led HVAC topics for Utah County and Salt Lake County service
  areas, with clear internal links and case-study evidence needs.
- Prepare briefs/outlines first. Do not publish, deploy, post, or make customer
  claims without explicit approval and proof.

## Scope

- Inventory the current blog library and service-area pages.
- Prepare 6-10 content briefs for blog posts or local proof pages.
- Map each brief to a target query, service intent, internal links, required
  proof, owner approval needs, and attribution tags to use after GA4/GSC access
  is restored.
- Flag pages that need refreshes, redirects, or consolidation, but do not edit
  live-facing page copy in this issue unless a follow-up implementation issue is
  created.

## Context

Air Express already has a blog surface and related HVAC pages in this repo:

- Existing blog posts: `blog/fall-furnace-prep.html`,
  `blog/geothermal-guide.html`, `blog/heat-pump-vs-furnace-utah.html`,
  `blog/hvac-buying-guide.html`, `blog/hvac-cost-guide.html`,
  `blog/hvac-glossary.html`, `blog/indoor-air-quality-utah.html`,
  `blog/spring-ac-prep.html`, `blog/summer-energy-efficiency.html`, and
  `blog/winter-heating-troubleshooting.html`.
- Templates: `templates/blog-index.html` and `templates/blog-post.html`.
- Strong internal-link targets include AC repair, AC replacement, furnace
  repair, heating installation, HVAC service, indoor air quality,
  maintenance-plan, emergency service, and city service-area pages.

The attribution lane is still blocked on GSC/GA4/GBP read scopes and live GA4
tag delivery. Content can still be prepared now, but performance proof should
not be claimed until analytics/location access and ServiceTitan lead evidence
are joined.

## Problem / Task

Create a content backlog that lets Air Express publish useful, locally grounded
HVAC content once James and Max approve the proof. The backlog should help
answer homeowner questions, support local service pages, and give New Reward a
clean baseline for measuring future organic/search/GEO impact.

## Suggested Content Lanes

| Working title | Primary intent | Suggested internal links | Proof needed before publish |
|---|---|---|---|
| How to Tell If Your AC Is Undersized in Utah County | AC replacement / diagnosis | `ac-replacement.html`, `ac-repair.html`, city AC pages | Technician checklist, approved examples, no customer PII |
| Furnace Repair vs Replacement in Lehi | Heating repair / replacement | `furnace-repair-lehi-ut.html`, `furnace-installation.html` | Approved decision criteria, warranty/age guidance |
| What an HVAC Tune-Up Includes Before a Saratoga Springs Summer | Maintenance | `ac-tune-up.html`, `maintenance-plan.html`, `service-area-saratoga-springs.html` | Air Express tune-up checklist and approved exclusions |
| Heat Pump Performance in Utah Winters | Heat pump education | `heat-pump.html`, `heating-services.html`, `energy-efficiency.html` | Climate guidance, equipment examples, approved limitations |
| Indoor Air Quality During Utah Inversions | IAQ / filtration | `indoor-air-quality.html`, `air-purifiers.html`, `air-filters.html` | Product-neutral IAQ guidance and approved recommendations |
| Emergency HVAC Checklist Before Calling After Hours | Emergency service | `emergency.html`, `schedule-service.html`, `contact.html` | Dispatch policy, safety disclaimers, after-hours boundaries |
| Why Some Rooms Stay Hot or Cold After a System Replacement | Ducting / comfort | `ductwork.html`, `air-duct-cleaning.html`, `hvac-service.html` | Technician notes on airflow, balancing, insulation caveats |
| Spring AC Startup Problems Utah Homeowners Can Check Safely | AC repair / safety | `ac-inspection.html`, `ac-maintenance.html`, `ac-repair.html` | Safe homeowner checks and clear stop-work warnings |
| What HVAC Rebates and Financing Questions to Ask in Utah | Financing / replacement | `financing.html`, `energy-efficiency.html`, `hvac-installation.html` | Current offer verification before publish |
| Case Study: From No-Cool Call to Repaired Comfort | Proof page / conversion | service page based on job type | Max-approved story, photos, outcome, permission status |

## Acceptance Criteria

- 6-10 content briefs exist with target query, buyer stage, outline, internal
  links, proof requirements, and publication gate. Current structured matrix:
  `data/content-briefs.csv`; readable summary:
  `docs/air-express-content-briefs.md`.
- Briefs distinguish verified Air Express facts from assumptions and suggested
  claims.
- Each brief has a recommended attribution plan: canonical URL, UTM guidance for
  any later distribution, and expected GA4/GSC dimensions to review after access
  is restored.
- Existing blog/page conflicts are flagged before any new URL is recommended.
- No public posts, live page edits, provider changes, paid submissions, or
  customer-identifying details are produced without explicit approval.

## Operational Boundaries

- Read-only planning and local drafts only.
- No public sends, public posts, production deploys, CMS edits, Google changes,
  ServiceTitan changes, or paid directory actions.
- No testimonials, case studies, ratings, response-time claims, pricing claims,
  rebate claims, guarantee claims, or customer photos without owner-approved
  proof.

## Notes For Future Agents

- You are not alone in this repo. Preserve unrelated launch/content changes and
  do not revert files you did not edit.
- Start with the existing `blog/`, `templates/`, service pages, and
  `data/seo-geo-attribution-audit.json`.
- Return: status, briefs prepared, evidence, blockers, risks, recommended next
  action.
- If implementation expands beyond briefs/outlines, create a child issue for
  the exact page or post being edited.

## Open Questions

- Which topics does Max want Air Express to be known for first: emergency
  repair, replacements, maintenance plans, IAQ, or heat pumps?
- Which service areas should lead the first publication batch?
- Which completed jobs can be used as anonymized or named case studies?
