#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const outPath = path.join(rootDir, "data", "public-claim-register.json");

const EXCLUDED_DIRS = new Set([".git", "admin", "data", "node_modules", "output", "pages", "templates"]);

const CLAIMS = [
  {
    id: "bbb_accredited",
    label: "BBB Accredited",
    pattern: /\bBBB\s+Accredited\b/i,
    expectedStatus: "forbidden_until_public_status_changes",
    failIfPresent: true,
    proof: "Current BBB public profile for Air Express says the business is not BBB accredited and not rated.",
    source: "https://www.bbb.org/us/ut/lehi/profile/residential-air-conditioning-contractors/air-express-heating-and-air-conditioning-inc-1166-22004264",
  },
  {
    id: "bbb_business_profile",
    label: "BBB Business Profile",
    pattern: /\bBBB\s+Business\s+Profile\b/i,
    expectedStatus: "allowed_public_profile_reference",
    failIfPresent: false,
    proof: "Current BBB public profile exists; accreditation is not claimed.",
    source: "https://www.bbb.org/us/ut/lehi/profile/residential-air-conditioning-contractors/air-express-heating-and-air-conditioning-inc-1166-22004264",
  },
  {
    id: "google_rating_4_9",
    label: "4.9 review rating",
    pattern: /\b4\.9(?:★|\s+stars?|\s*rating)?\b/i,
    expectedStatus: "proof_gated_registered",
    failIfPresent: false,
    proof: "Needs current GBP/review-source proof before owner-facing claim closeout.",
    source: "https://g.page/r/CYZKv5H3bwNzEBM/review",
  },
  {
    id: "review_count_280",
    label: "280+ reviews",
    pattern: /\b280\+\s+(?:reviews|families|five-star reviews)\b/i,
    expectedStatus: "proof_gated_registered",
    failIfPresent: false,
    proof: "Needs current GBP/review-source proof before owner-facing claim closeout.",
    source: "https://g.page/r/CYZKv5H3bwNzEBM/review",
  },
  {
    id: "business_started_1996",
    label: "Since 1996",
    pattern: /\b(?:since|started|serving [^<]{0,40} since)\s+1996\b/i,
    expectedStatus: "public_source_supported",
    failIfPresent: false,
    proof: "BBB profile records Business Started and Business Started Locally as 6/12/1996.",
    source: "https://www.bbb.org/us/ut/lehi/profile/residential-air-conditioning-contractors/air-express-heating-and-air-conditioning-inc-1166-22004264",
  },
  {
    id: "years_30",
    label: "30 years / 30 yr",
    pattern: /\b(?:30\s*yr|30\s+years?|nearly\s+30[- ]year)\b/i,
    expectedStatus: "public_source_supported",
    failIfPresent: false,
    proof: "BBB profile records years in business as 29 as of the current public profile; 30-year copy is directionally tied to 1996 but should be date-reviewed.",
    source: "https://www.bbb.org/us/ut/lehi/profile/residential-air-conditioning-contractors/air-express-heating-and-air-conditioning-inc-1166-22004264",
  },
  {
    id: "emergency_24_7",
    label: "24/7 emergency service",
    pattern: /\b24\/7\b/i,
    expectedStatus: "owner_proof_gated_registered",
    failIfPresent: false,
    proof: "Needs owner approval/dispatch policy proof before final claim closeout.",
    source: "owner proof required",
  },
  {
    id: "callback_under_1hr",
    label: "Under 1 hour callback",
    pattern: /(?:<\s*1hr|under\s+(?:an?\s+)?hour|within\s+(?:an?\s+)?hour)/i,
    expectedStatus: "owner_proof_gated_registered",
    failIfPresent: false,
    proof: "Needs owner-approved response-time proof or should stay out of final proof claims.",
    source: "owner proof required",
  },
  {
    id: "financing_0_apr",
    label: "0% APR financing",
    pattern: /\b0%\s*APR\b/i,
    expectedStatus: "provider_offer_proof_gated_registered",
    failIfPresent: false,
    proof: "Needs current financing offer proof and terms before owner-facing claim closeout.",
    source: "Momnt/provider offer proof required",
  },
  {
    id: "license_number",
    label: "Utah license number",
    pattern: /\bLicense\s+#?96-324211-550\b/i,
    expectedStatus: "public_or_owner_proof_registered",
    failIfPresent: false,
    proof: "Needs current Utah DOPL/owner proof before final claim closeout.",
    source: "https://dopl.utah.gov/licenses/",
  },
  {
    id: "nate_certified",
    label: "NATE certified",
    pattern: /\bNATE\s+Certified\b/i,
    expectedStatus: "owner_proof_gated_registered",
    failIfPresent: false,
    proof: "Needs owner/team certification proof before final claim closeout.",
    source: "owner proof required",
  },
  {
    id: "epa_608",
    label: "EPA 608 certified",
    pattern: /\bEPA\s+608\s+Certified\b/i,
    expectedStatus: "owner_proof_gated_registered",
    failIfPresent: false,
    proof: "Needs owner/team certification proof before final claim closeout.",
    source: "owner proof required",
  },
  {
    id: "authorized_goodman",
    label: "Authorized Goodman dealer",
    pattern: /\bAuthorized\s+Goodman\s+Dealer\b/i,
    expectedStatus: "owner_or_manufacturer_proof_gated_registered",
    failIfPresent: false,
    proof: "Needs owner/manufacturer listing proof before final claim closeout.",
    source: "owner or Goodman proof required",
  },
];

function walkFiles(directory = rootDir, files = []) {
  for (const dirent of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, dirent.name);
    const relative = path.relative(rootDir, absolute).replaceAll(path.sep, "/");
    if (dirent.isDirectory()) {
      if (EXCLUDED_DIRS.has(relative.split("/")[0]) || dirent.name.startsWith(".")) {
        continue;
      }
      walkFiles(absolute, files);
      continue;
    }
    if (relative.endsWith(".html") && relative !== "404.html") {
      files.push(relative);
    }
  }
  return files;
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function extractSnippet(source, index, length) {
  return source
    .slice(Math.max(0, index - 70), Math.min(source.length, index + length + 70))
    .replace(/\s+/g, " ")
    .trim();
}

function scanClaim(file, source, claim) {
  const regex = new RegExp(claim.pattern.source, claim.pattern.flags.includes("g") ? claim.pattern.flags : `${claim.pattern.flags}g`);
  const matches = [];
  for (const match of source.matchAll(regex)) {
    matches.push({
      file,
      line: lineNumberForIndex(source, match.index || 0),
      snippet: extractSnippet(source, match.index || 0, match[0].length),
    });
  }
  return matches;
}

function main() {
  const files = walkFiles().sort();
  const sourceByFile = new Map(files.map((file) => [file, fs.readFileSync(path.join(rootDir, file), "utf8")]));
  const claims = CLAIMS.map((claim) => {
    const occurrences = [];
    for (const [file, source] of sourceByFile) {
      occurrences.push(...scanClaim(file, source, claim));
    }
    return {
      id: claim.id,
      label: claim.label,
      status: claim.failIfPresent && occurrences.length
        ? "failed_forbidden_claim_present"
        : claim.expectedStatus,
      occurrenceCount: occurrences.length,
      failIfPresent: claim.failIfPresent,
      proof: claim.proof,
      source: claim.source,
      occurrences: occurrences.slice(0, 40),
    };
  });

  const failures = claims
    .filter((claim) => claim.failIfPresent && claim.occurrenceCount > 0)
    .map((claim) => `${claim.label} appears ${claim.occurrenceCount} time(s) but is forbidden until public proof changes.`);

  const manifest = {
    generatedAt: new Date().toISOString(),
    status: failures.length ? "failed" : "passed",
    scope:
      "Local public HTML claim scan. No provider mutation, public profile edit, external send, deploy, token use, or customer data access.",
    sourceNote:
      "Public sources are recorded as proof references, but this command does not fetch or mutate external providers.",
    summary: {
      scannedHtmlFiles: files.length,
      registeredClaimTypes: claims.length,
      forbiddenClaimFailures: failures.length,
      proofGatedClaimTypes: claims.filter((claim) => claim.status.includes("proof_gated")).length,
    },
    claims,
    failures,
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);
  console.log(`Status: ${manifest.status}`);

  if (failures.length) {
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }
}

main();
