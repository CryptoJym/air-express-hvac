# Air Express ServiceTitan Redacted Export Import

Status: prepared only. No ServiceTitan API call, CRM mutation, live test lead,
customer edit, booking edit, revenue edit, provider change, or production
mutation is performed by this import path.

Use this path when Max, Air Express, ServiceTitan, or an approved New Reward
operator supplies a redacted lead export or screenshot-derived CSV for #30.

## Command

```bash
npm run import:servicetitan-redacted-export -- --input <path-to-redacted-csv>
```

Before importing an approved export, run:

```bash
npm run test:servicetitan-redacted-import
```

The regression test verifies awaiting-input behavior, safe alias
normalization, and PII column/value rejection without persisting raw private
values.

Without `--input`, the command writes the safe template and an
`awaiting_input` status manifest:

- `data/servicetitan-redacted-export-template.csv`
- `data/servicetitan-redacted-export-import-status.json`

When a clean export is imported, the command writes:

- `data/servicetitan-redacted-export-import.csv`
- `data/servicetitan-redacted-export-import-status.json`

The import output derives `new_reward_impact_period` from `created_at`; Max or
ServiceTitan does not need to supply that column. Current periods are:

- `before_new_reward_target_brief`: through 2026-03-11
- `target_brief_to_ga4_lead_proof`: 2026-03-12 through 2026-04-23
- `after_ga4_lead_proof`: 2026-04-24 forward

The status JSON includes `impactPeriodCounts` after import so #30 can quickly
show whether the redacted proof covers the relevant New Reward windows.

## Allowed Fields

Use only these fields:

- `service_titan_lead_id`
- `created_at`
- `campaign_id_or_source`
- `service_type_or_category`
- `lead_status`
- `booked_job_id_if_available`
- `sold_or_revenue_marker_if_approved`

Derived output field:

- `new_reward_impact_period`

The importer accepts common aliases such as `lead_id`, `campaign_id`,
`source`, `service_type`, `status`, and `job_id`, then normalizes them to the
safe schema.

## Prohibited Fields

Do not include:

- customer names
- first or last names
- phone numbers
- email addresses
- street addresses
- city, ZIP, or postal address fields
- raw notes or private descriptions
- payment data
- card data
- invoice data
- passwords, tokens, cookies, or credentials

If prohibited column names or obvious private values are detected, the importer
rejects the file and records only column names, row numbers, and pattern labels.
It does not persist raw private values.

## Done Proof For #30

This import path is only one input to #30. The issue is closure-ready only when:

- the redacted export source is approved;
- the import status is `imported`;
- the import contains the relevant historical periods;
- the impact report joins safe lead fields to the New Reward milestones;
- customer PII remains excluded;
- `npm run test:servicetitan-redacted-import` passes;
- `npm run verify:onboarding-evidence` passes after import.
