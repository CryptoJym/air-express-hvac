# Air Express Content Briefs

Last updated: 2026-06-03

Status: prepared locally only. No public posts, production deploys, social
posts, email sends, Google Business Profile updates, or ServiceTitan changes
were made.

## This Week

| ID | Asset | Status | Gate |
|---|---|---|---|
| CB-001 | `first-hot-week-ac-checklist-utah` | ready in source and generated locally | Air Express deploy or New Reward edge sync approval |
| CB-002 | `wildfire-smoke-hvac-filter-utah` | review draft with Utah DEQ, EPA, and AirNow references | Max/New Reward content approval |
| CB-003 | `thermostat-settings-utah-heat-wave` | review draft with ENERGY STAR and DOE references | Max/New Reward content approval |

## Brief Matrix

The full structured matrix is in
`data/content-briefs.csv`. It records each brief's target query, buyer stage,
recommended slug, outline, internal links, proof needed before publication,
publication gate, and attribution plan.

## Priority Briefs

1. **First hot-week AC checklist**
   - Target query: `Utah first hot week AC checklist`
   - Intent: AC maintenance and repair triage
   - Proof gate: homeowner safety guidance only; no diagnostic guarantees
   - Attribution: `air_express_summer_2026`, `first_hot_week_ac_checklist`

2. **Wildfire smoke HVAC filter guide**
   - Target query: `Utah wildfire smoke HVAC filter`
   - Intent: indoor air quality and filtration education
   - Proof gate: product-neutral guidance, official Utah DEQ/EPA/AirNow references, and no health outcome claims
   - Attribution: `air_express_summer_2026`, `wildfire_smoke_hvac_filter`

3. **Utah heat-wave thermostat settings**
   - Target query: `Utah heat wave thermostat settings`
   - Intent: energy efficiency and AC performance education
   - Proof gate: ENERGY STAR/DOE references, no universal setpoint, and no savings guarantees
   - Attribution: `air_express_summer_2026`, `thermostat_heat_wave`

4. **AC undersized in Utah County**
   - Target query: `AC undersized Utah County`
   - Intent: AC replacement and diagnosis
   - Proof gate: technician checklist and approved examples

5. **Furnace repair vs replacement in Lehi**
   - Target query: `furnace repair vs replacement Lehi`
   - Intent: heating repair/replacement decision support
   - Proof gate: approved decision criteria, warranty/age caveats

6. **Saratoga Springs summer HVAC tune-up**
   - Target query: `HVAC tune up Saratoga Springs summer`
   - Intent: maintenance-plan and AC tune-up education
   - Proof gate: approved Air Express tune-up scope and exclusions

7. **Indoor air quality during Utah inversions**
   - Target query: `Utah inversion indoor air quality HVAC`
   - Intent: IAQ and filtration education
   - Proof gate: product-neutral guidance and no medical outcome claims

8. **Emergency HVAC checklist before calling after hours**
   - Target query: `emergency HVAC checklist Utah`
   - Intent: emergency service triage and safety
   - Proof gate: dispatch policy, after-hours boundaries, safety review

9. **Why some rooms stay hot or cold after replacement**
   - Target query: `rooms hot after HVAC replacement Utah`
   - Intent: ducting, balancing, and comfort troubleshooting
   - Proof gate: technician notes on airflow, balancing, and insulation caveats

10. **No-cool repair case study**
    - Target query: `Air Express AC repair case study`
    - Intent: proof-led conversion content
    - Proof gate: Max-approved story, photos, outcome, testimonial permission,
      and redacted ServiceTitan/source proof

## Publication Rules

- Do not publish draft posts before Max/New Reward approval.
- Do not claim posts are live until the production URL returns HTTP 200 and the
  post appears in the live blog index/sitemap.
- Do not add testimonials, customer photos, ratings, response-time claims,
  pricing claims, rebate claims, guarantee claims, or revenue/outcome claims
  without owner-approved proof.
- Do not post to Facebook, GBP, Instagram, email, or any public channel until
  account access and channel approval are confirmed.
- Use UTM tags only after the approved channel and URL are known.

## Measurement Plan

After GSC/GA4 access is restored, review:

- GSC query, page, device, and date rows for each canonical URL.
- GA4 landing-page sessions, engaged sessions, events, and key events.
- `generate_lead` events after the live GA4 source is verified.
- ServiceTitan source/campaign notes only through approved redacted exports or
  read-only proof packets.

Treat content lift as directional until GSC, GA4, and ServiceTitan evidence are
joined.
