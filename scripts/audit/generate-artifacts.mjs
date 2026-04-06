import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildLegacyDestination, optionFilesFromEntries } from './legacy-route-rules.mjs';

const repoRoot = process.cwd();
const targetRoot = path.join(repoRoot, 'option-c');
const auditRoot = path.join(repoRoot, 'audit');
const liveOrigin = process.env.LIVE_ORIGIN || 'https://www.airexpresshvac.net';
const sitemapIndexUrl = `${liveOrigin}/sitemap_index.xml`;
const fetchTimeoutMs = 20_000;
const fetchConcurrency = 6;

const PRIORITY_PAGES = [
  'index.html',
  'contact.html',
  'request-estimate.html',
  'schedule-service.html',
  'reviews.html',
  'financing.html',
  'privacy-policy.html',
  'terms-of-service.html',
  '404.html'
];

const genericTokens = new Set([
  'a',
  'an',
  'and',
  'air',
  'all',
  'best',
  'company',
  'cooling',
  'county',
  'expert',
  'for',
  'from',
  'heating',
  'home',
  'homes',
  'hvac',
  'in',
  'installation',
  'installations',
  'learn',
  'more',
  'service',
  'services',
  'system',
  'systems',
  'the',
  'to',
  'ultimate',
  'ut',
  'your'
]);

const cityTokens = new Set([
  'alpine',
  'american',
  'bluffdale',
  'draper',
  'eagle',
  'fork',
  'grove',
  'highland',
  'jordan',
  'lehi',
  'mountain',
  'orem',
  'pleasant',
  'provo',
  'sandy',
  'saratoga',
  'south',
  'springs',
  'west'
]);

const statCache = new Set();

const normalizeWhitespace = (value) => value.replace(/\s+/g, ' ').trim();

const stripTags = (html) =>
  normalizeWhitespace(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  );

const firstMatch = (input, regex) => {
  const match = input.match(regex);
  return match ? normalizeWhitespace(match[1]) : '';
};

const countMatches = (input, regex) => [...input.matchAll(regex)].length;

const normalizePhone = (value) => value.replace(/\D+/g, '');

const extractPhone = (html, text) => {
  const schemaMatch = html.match(/"telephone"\s*:\s*"([^"]+)"/i);
  if (schemaMatch) return normalizePhone(schemaMatch[1]);
  const textMatch = text.match(/\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/);
  return textMatch ? normalizePhone(textMatch[0]) : '';
};

const extractAddress = (html, text) => {
  const street = firstMatch(html, /"streetAddress"\s*:\s*"([^"]+)"/i);
  const locality = firstMatch(html, /"addressLocality"\s*:\s*"([^"]+)"/i);
  const region = firstMatch(html, /"addressRegion"\s*:\s*"([^"]+)"/i);
  if (street || locality || region) {
    return normalizeWhitespace([street, locality, region].filter(Boolean).join(', '));
  }

  const textMatch = text.match(/\d{2,5}\s+[^.]+?,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s+\d{5}/);
  return textMatch ? normalizeWhitespace(textMatch[0]) : '';
};

const extractBrand = (html, title) =>
  firstMatch(html, /"name"\s*:\s*"([^"]+)"/i) ||
  firstMatch(html, /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i) ||
  title.split('|').map((part) => normalizeWhitespace(part)).find(Boolean) ||
  '';

const extractRating = (html) => firstMatch(html, /"ratingValue"\s*:\s*"([^"]+)"/i) || firstMatch(html, /(\d\.\d)\s*[★*]/i);

const extractReviewCount = (html, text) => {
  const schemaValue = firstMatch(html, /"reviewCount"\s*:\s*"([^"]+)"/i);
  if (schemaValue) return schemaValue;
  const textMatch = text.match(/(\d{2,4})\+\s+(?:happy|satisfied)\s+(?:families|customers)/i);
  return textMatch ? textMatch[1] : '';
};

const extractYears = (html, text) =>
  [...new Set([...(html.match(/\b(?:19|20)\d{2}\b/g) || []), ...(text.match(/\b(?:19|20)\d{2}\b/g) || [])])].sort();

const slugFromUrl = (url) => {
  const parsed = new URL(url);
  const pathname = parsed.pathname === '/' ? '' : parsed.pathname.replace(/^\/|\/$/g, '');
  return pathname;
};

const slugFromFile = (file) => (file === 'index.html' ? '' : file.replace(/\.html$/i, ''));

const toCsv = (rows) => {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const stringValue = String(value ?? '');
    return /[",\n]/.test(stringValue) ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
  };

  return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
};

const rootRelativeTarget = (ref) => path.join(targetRoot, ref.replace(/^\/+/, ''));

const localRefTarget = (ref, fileDir) => {
  const sanitized = ref.split('?')[0].split('#')[0];
  if (!sanitized) return '';
  if (sanitized.startsWith('/')) return rootRelativeTarget(sanitized);
  return path.resolve(fileDir, sanitized);
};

const shouldIgnoreRef = (ref) => !ref || /^(https?:|mailto:|tel:|#|javascript:|data:|\/\/)/i.test(ref);

const summarizeMissingRefs = (html, filePath) => {
  const refs = [];
  const regex = /(href|src)=["']([^"']+)["']/gi;
  const fileDir = path.dirname(filePath);

  for (const match of html.matchAll(regex)) {
    const ref = match[2].trim();
    if (shouldIgnoreRef(ref)) continue;

    const targetPath = localRefTarget(ref, fileDir);
    refs.push({
      ref,
      exists: statCache.has(targetPath)
    });
  }

  return refs.filter((entry) => !entry.exists).map((entry) => entry.ref);
};

const normalizeForTokens = (value) =>
  value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const tokenize = (value) =>
  normalizeForTokens(value)
    .split(/\s+/)
    .filter((token) => token && !genericTokens.has(token));

const rawSlugTokens = (value) => normalizeForTokens(value).split(/\s+/).filter(Boolean);

const setSimilarity = (left, right) => {
  const leftSet = new Set(left);
  const rightSet = new Set(right);

  if (!leftSet.size && !rightSet.size) return 0;

  let intersection = 0;
  for (const token of leftSet) {
    if (rightSet.has(token)) intersection += 1;
  }

  return intersection / new Set([...leftSet, ...rightSet]).size;
};

const containsScore = (left, right) => {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.75;
  return 0;
};

const sharedCityScore = (leftTokens, rightTokens) => {
  const leftCities = leftTokens.filter((token) => cityTokens.has(token));
  const rightCities = rightTokens.filter((token) => cityTokens.has(token));
  return setSimilarity(leftCities, rightCities);
};

const templateFamily = (identifier) => {
  const slug = identifier.replace(/\.html$/i, '');
  const lowerSlug = slug.toLowerCase();
  const tokens = rawSlugTokens(slug);

  if (!slug || slug === 'index') return 'home';
  if (lowerSlug === 'contact') return 'contact';
  if (lowerSlug === 'request-estimate' || lowerSlug === 'estimate') return 'estimate';
  if (lowerSlug === 'schedule-service' || lowerSlug === 'schedule-hvac-service') return 'schedule';
  if (tokens.includes('privacy') || tokens.includes('terms')) return 'legal';
  if (tokens.includes('review') || tokens.includes('reviews')) return 'reviews';
  if (tokens.includes('financing')) return 'financing';
  if (lowerSlug.startsWith('service-area-') || /-ut-air-conditioning-heating-services$/.test(lowerSlug)) return 'service-area';
  if (lowerSlug === 'hvac-blog') return 'blog-index';
  if (lowerSlug.includes('light-commercial') || tokens.includes('commercial') || tokens.includes('multifamily') || tokens.includes('residential') || lowerSlug.includes('new-construction') || lowerSlug.includes('who-we-serve')) return 'audience';
  if (tokens.some((token) => ['blog', 'guide', 'troubleshoot', 'benefits', 'tips', 'checklist', 'issues', 'problems', 'solutions', 'warning', 'signs', 'weather', 'winter', 'summer', 'spring', 'fall'].includes(token))) return 'article';
  if (
    lowerSlug.includes('ductless') ||
    lowerSlug.includes('ductwork') ||
    lowerSlug.includes('thermostat') ||
    lowerSlug.includes('humidification') ||
    lowerSlug.includes('purifier') ||
    lowerSlug.includes('filter') ||
    lowerSlug.includes('maintenance-plan')
  ) {
    return 'service';
  }
  if (tokens.some((token) => ['ac', 'air', 'heating', 'furnace', 'duct', 'ventilation', 'filtration', 'humid', 'dehumid', 'thermostat', 'thermostats', 'heat', 'pump', 'water', 'heater', 'gas', 'lines', 'mini', 'split', 'energy', 'efficiency', 'hvac', 'maintenance', 'filters', 'purifiers', 'ductless', 'ductwork'].includes(token))) return 'service';
  return 'other';
};

const normalizeCta = (ref) => {
  const value = ref.toLowerCase();
  if (value.startsWith('tel:')) return 'call';
  if (value.includes('request-estimate')) return 'estimate';
  if (value.includes('schedule-service')) return 'schedule';
  if (value.includes('contact')) return 'contact';
  return '';
};

const parsePage = ({ kind, identifier, filePath = '', url = '', html }) => {
  const text = stripTags(html);
  const title = firstMatch(html, /<title>([^<]*)<\/title>/i);
  const h1 = firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i).replace(/<[^>]+>/g, '').trim();
  const description = firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
  const canonical = firstMatch(html, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const ogUrl = firstMatch(html, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  const slug = kind === 'live' ? slugFromUrl(url) : slugFromFile(identifier);
  const family = templateFamily(slug || (kind === 'live' ? 'index' : identifier));
  const bodyHash = crypto.createHash('sha1').update(text).digest('hex');
  const ctas = [...new Set((html.match(/href=["']([^"']*(?:contact|request-estimate|schedule-service|tel:)[^"']*)["']/gi) || []).map((entry) => entry.replace(/^href=["']|["']$/g, '')))];
  const formActions = [...new Set((html.match(/action=["']([^"']+)["']/gi) || []).map((entry) => entry.replace(/^action=["']|["']$/g, '')))];
  const tokens = tokenize([slug, title, h1, description].filter(Boolean).join(' '));
  const phone = extractPhone(html, text);
  const address = extractAddress(html, text);
  const brand = extractBrand(html, title);
  const rating = extractRating(html);
  const reviewCount = extractReviewCount(html, text);
  const years = extractYears(html, text);

  return {
    kind,
    identifier,
    url: url || '',
    slug,
    title,
    h1,
    description,
    canonical,
    ogUrl,
    family,
    bodyHash,
    forms: countMatches(html, /<form\b/gi),
    footerCount: countMatches(html, /<footer\b/gi),
    navScriptTags: countMatches(html, /<script[^>]+src=["']nav\.js["']/gi),
    inlineNavDuplicate: html.includes("var toggle = document.querySelector('.nav-toggle');"),
    emptyHeader: /<header>\s*<\/header>/i.test(html),
    missingHeaderWrapper: !/<header[\s>]/i.test(html) && html.includes('header-content'),
    previewMetadata: html.includes('https://option-c-nine.vercel.app'),
    placeholderReviews: /href=["']#["'][^>]*class=["'][^"']*review-link/i.test(html),
    ctas,
    ctaTypes: [...new Set(ctas.map(normalizeCta).filter(Boolean))],
    formActions,
    phone,
    address,
    brand,
    rating,
    reviewCount,
    years,
    tokens,
    missingLocalRefs: kind === 'option' ? summarizeMissingRefs(html, filePath) : [],
    sourcePath: filePath
  };
};

const deriveDirectMatch = (liveSlug, optionBySlug, optionFiles) => {
  if (!liveSlug) return { page: optionBySlug.get('index'), reason: 'home-route' };

  const destinationFile = buildLegacyDestination(liveSlug, optionFiles);
  if (!destinationFile) return { page: null, reason: 'no-direct-match' };

  const destinationSlug = destinationFile.replace(/\.html$/i, '');
  if (!optionBySlug.has(destinationSlug)) return { page: null, reason: 'no-direct-match' };

  return {
    page: optionBySlug.get(destinationSlug),
    reason: optionBySlug.has(liveSlug) ? 'direct-slug-rule' : 'legacy-route-rule'
  };
};

const matchOptionPage = (livePage, optionPages, optionBySlug, optionFiles) => {
  const direct = deriveDirectMatch(livePage.slug, optionBySlug, optionFiles);
  if (direct.page) {
    return { page: direct.page, score: 1, confidence: 'exact', reason: direct.reason };
  }

  let best = { page: null, score: 0, confidence: 'low', reason: 'no-match' };

  for (const optionPage of optionPages) {
    const slugSimilarity = Math.max(
      setSimilarity(tokenize(livePage.slug), tokenize(optionPage.slug)),
      containsScore(livePage.slug, optionPage.slug)
    );
    const titleSimilarity = setSimilarity(tokenize(livePage.title), tokenize(optionPage.title));
    const h1Similarity = setSimilarity(tokenize(livePage.h1), tokenize(optionPage.h1));
    const descriptionSimilarity = setSimilarity(tokenize(livePage.description), tokenize(optionPage.description));
    const familyBonus = livePage.family === optionPage.family ? 0.12 : 0;
    const cityBonus = sharedCityScore(livePage.tokens, optionPage.tokens) * 0.08;
    const score = Math.min(
      1,
      slugSimilarity * 0.42 +
        titleSimilarity * 0.24 +
        h1Similarity * 0.16 +
        descriptionSimilarity * 0.1 +
        familyBonus +
        cityBonus
    );

    if (score > best.score) {
      best = {
        page: optionPage,
        score,
        confidence: score >= 0.8 ? 'high' : score >= 0.55 ? 'medium' : 'low',
        reason: score >= 0.8 ? 'high-token-similarity' : 'best-token-similarity'
      };
    }
  }

  return best;
};

const compareFacts = (livePage, optionPage) => {
  const titleSimilarity = setSimilarity(tokenize(livePage.title), tokenize(optionPage.title));
  const h1Similarity = setSimilarity(tokenize(livePage.h1), tokenize(optionPage.h1));
  const descriptionSimilarity = setSimilarity(tokenize(livePage.description), tokenize(optionPage.description));
  const ctaOverlap = setSimilarity(livePage.ctaTypes, optionPage.ctaTypes);

  return {
    titleSimilarity,
    h1Similarity,
    descriptionSimilarity,
    ctaOverlap,
    phoneMatch: !livePage.phone || !optionPage.phone ? 'unknown' : livePage.phone === optionPage.phone ? 'yes' : 'no',
    addressMatch: !livePage.address || !optionPage.address ? 'unknown' : livePage.address === optionPage.address ? 'yes' : 'no',
    yearMatch: !livePage.years.length || !optionPage.years.length
      ? 'unknown'
      : livePage.years.some((year) => optionPage.years.includes(year))
        ? 'yes'
        : 'no',
    ratingMatch: !livePage.rating || !optionPage.rating ? 'unknown' : livePage.rating === optionPage.rating ? 'yes' : 'no',
    reviewCountMatch: !livePage.reviewCount || !optionPage.reviewCount
      ? 'unknown'
      : livePage.reviewCount === optionPage.reviewCount
        ? 'yes'
        : 'no'
  };
};

async function primeStatCache(root) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(root, entry.name);
    statCache.add(absolute);
    if (entry.isDirectory()) {
      await primeStatCache(absolute);
    }
  }
}

async function fetchText(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), fetchTimeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'Codex Air Express Audit/1.0' }
    });
    if (!response.ok) return '';
    return await response.text();
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
}

const extractLocs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/gi)].map((match) => match[1].trim());

async function fetchSitemapUrls(url, seen = new Set()) {
  if (seen.has(url)) return [];
  seen.add(url);

  const xml = await fetchText(url);
  if (!xml) return [];

  const locs = extractLocs(xml).filter((loc) => loc.startsWith(liveOrigin));
  if (/<sitemapindex/i.test(xml)) {
    const nested = await Promise.all(locs.map((loc) => fetchSitemapUrls(loc, seen)));
    return nested.flat();
  }

  return locs.filter((loc) => !loc.endsWith('.kml'));
}

async function mapLimit(items, limit, iteratee) {
  const results = new Array(items.length);
  let index = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (index < items.length) {
        const current = index;
        index += 1;
        results[current] = await iteratee(items[current], current);
      }
    })
  );

  return results;
}

const files = (await fs.readdir(targetRoot)).filter((file) => file.endsWith('.html')).sort();
await primeStatCache(targetRoot);
await fs.mkdir(auditRoot, { recursive: true });

const optionPages = [];
for (const file of files) {
  const fullPath = path.join(targetRoot, file);
  const html = await fs.readFile(fullPath, 'utf8');
  optionPages.push(parsePage({ kind: 'option', identifier: file, filePath: fullPath, html }));
}

const optionBySlug = new Map(optionPages.map((page) => [page.slug || 'index', page]));
const optionFiles = optionFilesFromEntries(optionPages.map((page) => page.identifier));

const liveUrls = [...new Set(await fetchSitemapUrls(sitemapIndexUrl))].sort((left, right) => left.localeCompare(right));
const livePages = (await mapLimit(liveUrls, fetchConcurrency, async (url) => {
  const html = await fetchText(url);
  if (!html) {
    return {
      kind: 'live',
      identifier: url,
      url,
      slug: slugFromUrl(url),
      title: '',
      h1: '',
      description: '',
      canonical: '',
      ogUrl: '',
      family: templateFamily(slugFromUrl(url), ''),
      bodyHash: '',
      forms: 0,
      footerCount: 0,
      navScriptTags: 0,
      inlineNavDuplicate: false,
      emptyHeader: false,
      missingHeaderWrapper: false,
      previewMetadata: false,
      placeholderReviews: false,
      ctas: [],
      ctaTypes: [],
      formActions: [],
      phone: '',
      address: '',
      brand: '',
      rating: '',
      reviewCount: '',
      years: [],
      tokens: [],
      missingLocalRefs: [],
      sourcePath: ''
    };
  }

  return parsePage({ kind: 'live', identifier: url, url, html });
})).filter(Boolean);

const parityRows = [];
const bugRows = [];

for (const optionPage of optionPages) {
  if (optionPage.previewMetadata) {
    bugRows.push({
      severity: 'P1',
      category: 'metadata',
      file: optionPage.identifier,
      issue: 'Preview deployment domain still present in canonical or og:url metadata',
      evidence: 'Found https://option-c-nine.vercel.app in page head',
      recommended_fix: 'Replace preview-domain metadata with https://www.airexpresshvac.net equivalents',
      status: 'open'
    });
  }

  if (optionPage.emptyHeader || optionPage.missingHeaderWrapper) {
    bugRows.push({
      severity: 'P0',
      category: 'navigation',
      file: optionPage.identifier,
      issue: 'Page shell is missing a valid site header wrapper',
      evidence: optionPage.emptyHeader ? 'Header tag is empty' : 'Header closing tag exists but opening wrapper is missing',
      recommended_fix: 'Restore the standard site header markup used by stable option-c templates',
      status: 'open'
    });
  }

  if (optionPage.footerCount > 1) {
    bugRows.push({
      severity: 'P1',
      category: 'template-drift',
      file: optionPage.identifier,
      issue: 'Page contains duplicate footer shells',
      evidence: `Detected ${optionPage.footerCount} footer elements`,
      recommended_fix: 'Remove legacy footer shell and keep the standard option-c footer only',
      status: 'open'
    });
  }

  if (optionPage.inlineNavDuplicate) {
    bugRows.push({
      severity: 'P2',
      category: 'javascript',
      file: optionPage.identifier,
      issue: 'Inline legacy navigation script duplicates shared nav.js behavior',
      evidence: "Detected inline nav script containing var toggle = document.querySelector('.nav-toggle');",
      recommended_fix: 'Remove duplicate inline script and rely on shared nav.js',
      status: 'open'
    });
  }

  if (optionPage.placeholderReviews) {
    bugRows.push({
      severity: 'P2',
      category: 'ux',
      file: optionPage.identifier,
      issue: 'Review-bar links are placeholders',
      evidence: 'Detected review-link anchors with href="#"',
      recommended_fix: 'Replace placeholder review links with live Google and Facebook review URLs',
      status: 'open'
    });
  }

  for (const ref of optionPage.missingLocalRefs) {
    bugRows.push({
      severity: ref.endsWith('.ico') ? 'P3' : 'P1',
      category: 'integrity',
      file: optionPage.identifier,
      issue: 'Local asset or route target is missing from option-c',
      evidence: ref,
      recommended_fix: 'Update the reference to an existing file or add the missing target',
      status: 'open'
    });
  }
}

for (const livePage of livePages) {
  const match = matchOptionPage(livePage, optionPages, optionBySlug, optionFiles);
  const optionPage = match.page;
  const facts = optionPage ? compareFacts(livePage, optionPage) : null;

  parityRows.push({
    live_url: livePage.url,
    live_family: livePage.family,
    option_file: optionPage?.identifier || '',
    option_family: optionPage?.family || '',
    match_confidence: match.confidence,
    match_score: match.score.toFixed(3),
    match_reason: match.reason,
    title_similarity: facts ? facts.titleSimilarity.toFixed(3) : '',
    h1_similarity: facts ? facts.h1Similarity.toFixed(3) : '',
    description_similarity: facts ? facts.descriptionSimilarity.toFixed(3) : '',
    cta_overlap: facts ? facts.ctaOverlap.toFixed(3) : '',
    phone_match: facts?.phoneMatch || '',
    address_match: facts?.addressMatch || '',
    year_match: facts?.yearMatch || '',
    rating_match: facts?.ratingMatch || '',
    review_count_match: facts?.reviewCountMatch || '',
    live_title: livePage.title,
    option_title: optionPage?.title || '',
    live_h1: livePage.h1,
    option_h1: optionPage?.h1 || ''
  });

  const criticalFamily = ['home', 'contact', 'estimate', 'schedule', 'legal', 'reviews', 'financing', 'service-area', 'service'];

  if (!optionPage || match.confidence === 'low') {
    bugRows.push({
      severity: criticalFamily.includes(livePage.family) ? 'P1' : 'P2',
      category: 'parity',
      file: livePage.url,
      issue: 'Live page does not have a confident option-c replacement',
      evidence: optionPage ? `Best candidate ${optionPage.identifier} scored ${match.score.toFixed(3)}` : 'No candidate match found',
      recommended_fix: 'Create or explicitly map a launch-candidate replacement page for this live URL',
      status: 'open'
    });
    continue;
  }

  if (criticalFamily.includes(livePage.family) && livePage.family !== optionPage.family) {
    bugRows.push({
      severity: 'P1',
      category: 'parity',
      file: livePage.url,
      issue: 'Live page maps to the wrong option-c template family',
      evidence: `${livePage.family} page matched to ${optionPage.family} (${optionPage.identifier})`,
      recommended_fix: 'Review template mapping and ensure a correct launch replacement exists',
      status: 'open'
    });
  }

  if (criticalFamily.includes(livePage.family) && facts?.phoneMatch === 'no') {
    bugRows.push({
      severity: 'P1',
      category: 'truth',
      file: livePage.url,
      issue: 'Phone number differs between live page and launch candidate',
      evidence: `${livePage.phone} vs ${optionPage.phone}`,
      recommended_fix: 'Verify the correct business phone number and align the launch candidate',
      status: 'open'
    });
  }

  if (['home', 'contact', 'legal'].includes(livePage.family) && facts?.addressMatch === 'no') {
    bugRows.push({
      severity: 'P1',
      category: 'truth',
      file: livePage.url,
      issue: 'Address differs between live page and launch candidate',
      evidence: `${livePage.address} vs ${optionPage.address}`,
      recommended_fix: 'Verify the correct business address and align schema/content before launch',
      status: 'open'
    });
  }

  if (['contact', 'estimate', 'schedule'].includes(livePage.family) && optionPage.forms === 0) {
    bugRows.push({
      severity: 'P0',
      category: 'conversion',
      file: livePage.url,
      issue: 'Launch candidate is missing a form for a live conversion page',
      evidence: `${optionPage.identifier} contains ${optionPage.forms} forms`,
      recommended_fix: 'Restore a working lead form before launch',
      status: 'open'
    });
  }
}

const existingLighthouse = await fs.readFile(path.join(auditRoot, 'lighthouse-baseline.json'), 'utf8').catch(() => '');
let lighthouseBaseline = {
  generatedAt: new Date().toISOString(),
  status: 'pending-runtime-audit',
  notes: 'Run `npm run audit:lighthouse` after dependencies are installed to replace placeholders with measured values.',
  pages: PRIORITY_PAGES.map((file) => ({
    file,
    url: `http://127.0.0.1:4173/${file === 'index.html' ? '' : file}`,
    metrics: {
      performance: null,
      accessibility: null,
      seo: null,
      lcp: null,
      cls: null,
      inp: null
    }
  }))
};

if (existingLighthouse) {
  try {
    const parsed = JSON.parse(existingLighthouse);
    if (parsed.status === 'complete') {
      lighthouseBaseline = parsed;
    }
  } catch {
    // Keep generated placeholder if the current file is malformed.
  }
}

await fs.writeFile(
  path.join(auditRoot, 'page-inventory.json'),
  `${JSON.stringify({ generatedAt: new Date().toISOString(), optionC: optionPages, liveSite: livePages }, null, 2)}\n`
);
await fs.writeFile(path.join(auditRoot, 'live-page-inventory.json'), `${JSON.stringify(livePages, null, 2)}\n`);
await fs.writeFile(path.join(auditRoot, 'parity-diff.csv'), `${toCsv(parityRows)}\n`);
await fs.writeFile(path.join(auditRoot, 'bug-backlog.csv'), `${toCsv(bugRows)}\n`);
await fs.writeFile(path.join(auditRoot, 'lighthouse-baseline.json'), `${JSON.stringify(lighthouseBaseline, null, 2)}\n`);

console.log(
  `Generated audit artifacts for ${optionPages.length} option-c pages and ${livePages.length} live-site pages in ${auditRoot}`
);
