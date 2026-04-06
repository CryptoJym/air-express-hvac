import path from 'node:path';

export const EXACT_ROUTE_OVERRIDES = new Map([
  ['about-us', 'about.html'],
  ['about-us/accessibility-statement', 'accessibility.html'],
  ['about-us/privacy-policy', 'privacy-policy.html'],
  ['apply-for-financing-lehi-ut', 'financing.html'],
  ['client-referrals', 'contact.html'],
  ['co2-detectors-lehi-ut', 'other-services-tests.html'],
  ['contact', 'contact.html'],
  ['creating-a-more-comfortable-and-smarter-home', 'resources.html'],
  ['daikin', 'other-products.html'],
  ['electric', 'other-products.html'],
  ['energy-audit-lehi-ut', 'energy-efficiency.html'],
  ['faqs', 'faq.html'],
  ['fix-hvac-system-when-it-stops-working', 'hvac-troubleshooter.html'],
  ['gain-insight-into-heat-pumps', 'heat-pump.html'],
  ['goodman', 'other-products.html'],
  ['home-performance-testing-lehi-ut', 'other-services-tests.html'],
  ['hood-vent-installation-lehi-ut', 'ventilation.html'],
  ['hvac-financing-lehi-ut', 'financing.html'],
  ['hvac-system-short-cycling-causes', 'hvac-troubleshooter.html'],
  ['identifying-strange-hvac-odors', 'hvac-troubleshooter.html'],
  ['incorrect-hvac-sizing-solutions', 'hvac-buying-guide.html'],
  ['key-role-of-uv-light-systems', 'air-purifiers.html'],
  ['maximize-your-hvac-system-efficiency', 'energy-efficiency.html'],
  ['newsletter-promotions-sign-up', 'specials.html'],
  ['other-services-and-tests-lehi-ut', 'other-services-tests.html'],
  ['other-services-lehi-ut', 'other-services.html'],
  ['professional-hvac-installation-advantages', 'hvac-installation.html'],
  ['proper-hvac-system-upgrades-and-maintenance', 'maintenance-plan.html'],
  ['schedule-hvac-service', 'schedule-service.html'],
  ['signs-hvac-system-needs-repair', 'hvac-repair.html'],
  ['sitemap', 'all-services.html'],
  ['understanding-hvac-system-clicking-noises', 'hvac-troubleshooter.html'],
  ['utilizing-uv-light-technology-advantages', 'air-purifiers.html'],
  ['uv-light-installation-guide', 'air-purifiers.html'],
  ['uv-light-installation-lehi-ut', 'air-purifiers.html'],
  ['uv-light-replacement-lehi-ut', 'air-purifiers.html'],
  ['uv-lights-lehi-ut', 'air-purifiers.html'],
  ['what-is-the-importance-of-hvac-maintenance', 'maintenance-plan.html'],
  ['why-hvac-systems-lose-efficiency', 'energy-efficiency.html'],
  ['winter-is-coming-10-tips-to-winterize-your-home', 'winter-heating-troubleshooting.html'],
  ['zoning-lehi-ut', 'other-services-tests.html'],
  ['carbon-dioxide-detector-lehi-ut', 'other-services-tests.html'],
  ['amana', 'other-products.html'],
  ['air-conditioner-repair-lehi-ut', 'ac-repair-lehi-ut.html'],
  ['air-conditioning-repair-lehi-ut', 'ac-repair-lehi-ut.html'],
  ['air-conditioner-repair-saratoga-springs-ut', 'ac-repair-saratoga-springs-ut.html'],
  ['air-conditioner-repair-eagle-mountain-ut', 'ac-repair-eagle-mountain-ut.html'],
  ['air-conditioning-eagle-mountain-ut', 'ac-installation-eagle-mountain-ut.html'],
  ['air-conditioning-saratoga-springs-ut', 'ac-installation-saratoga-springs-ut.html'],
  ['air-conditioning-service-eagle-mountain-ut', 'ac-installation-eagle-mountain-ut.html'],
  ['ductless-ac-installation-lehi-ut', 'ductless.html'],
  ['ductless-ac-repair-lehi-ut', 'ductless.html'],
  ['ductless-ac-replacement-lehi-ut', 'ductless.html'],
  ['ductless-ac-service-lehi-ut', 'ductless.html'],
  ['ductless-air-conditioner-inspection-lehi-ut', 'ductless.html'],
  ['ductless-air-conditioning-tune-up-lehi-ut', 'ductless.html'],
  ['ductless-heater-inspection-lehi-ut', 'ductless.html'],
  ['ductless-heater-maintenance-lehi-ut', 'ductless.html'],
  ['ductless-heater-tune-up-lehi-ut', 'ductless.html'],
  ['ductless-heating-installation-lehi-ut', 'ductless.html'],
  ['ductless-heating-replacement-lehi-ut', 'ductless.html'],
  ['ductless-heating-service-lehi-ut', 'ductless.html'],
  ['energy-efficient-hvac-systems-lehi-ut', 'energy-efficiency.html'],
  ['uneven-cooling-issues-solutions', 'ac-repair.html']
]);

const AC_REPAIR_FRAGMENTS = [
  'repair',
  'compressor',
  'refrigerant',
  'thermostat',
  'water-leak',
  'leakage',
  'odor',
  'warm-air',
  'short-cycl',
  'not-starting',
  'sound',
  'blower',
  'tripping',
  'freezes',
  'fan-problems',
  'power-issues',
  'warning-signs',
  'airflow'
];

const HEATING_REPAIR_FRAGMENTS = ['repair', 'not-working', 'troubleshoot'];
const HEATING_MAINTENANCE_FRAGMENTS = ['maintenance', 'winterize', 'checklist'];

export function optionFilesFromEntries(entries) {
  return new Set(entries.filter((entry) => entry.endsWith('.html')));
}

export function optionFilesFromTargetRoot(targetRoot, fsModule) {
  return optionFilesFromEntries(fsModule.readdirSync(targetRoot).filter((entry) => entry.endsWith('.html')));
}

export function slugFromPathname(pathname) {
  return pathname.replace(/^\/|\/$/g, '');
}

export function pathnameFromSlug(slug) {
  return slug ? `/${slug}` : '/';
}

function includesAny(slug, fragments) {
  return fragments.some((fragment) => slug.includes(fragment));
}

function hasOptionFile(optionFiles, file) {
  return optionFiles.has(file);
}

export function buildLegacyDestination(slug, optionFiles) {
  if (!slug) return 'index.html';

  if (EXACT_ROUTE_OVERRIDES.has(slug) && hasOptionFile(optionFiles, EXACT_ROUTE_OVERRIDES.get(slug))) {
    return EXACT_ROUTE_OVERRIDES.get(slug);
  }

  const serviceAreaMatch = slug.match(/^([a-z-]+)-ut-air-conditioning-heating-services$/);
  if (serviceAreaMatch) {
    const serviceAreaFile = `service-area-${serviceAreaMatch[1]}.html`;
    if (hasOptionFile(optionFiles, serviceAreaFile)) return serviceAreaFile;
  }

  const directFile = `${slug}.html`;
  if (hasOptionFile(optionFiles, directFile)) return directFile;

  if (slug.includes('light-commercial')) return 'light-commercial.html';
  if (slug.includes('multifamily')) return 'multifamily.html';
  if (slug.includes('residential')) return 'residential.html';
  if (slug.includes('new-construction')) return 'new-construction.html';
  if (slug.includes('commercial')) return 'commercial.html';

  if (slug.includes('air-filter') || slug.includes('significance-of-air-filter')) return 'air-filters.html';
  if (slug.includes('filtration')) return 'filtration.html';
  if (slug.includes('dehumidifier')) return 'dehumidifiers.html';
  if (slug.includes('humidifier')) return 'humidification.html';
  if (slug.includes('purif') || slug.includes('scrubb') || slug.includes('uv-coil') || slug.includes('uv-light')) {
    return 'air-purifiers.html';
  }
  if (slug.includes('air-quality') || slug.includes('allergy') || slug.includes('indoor-air-quality') || slug.includes('humidity')) {
    return 'indoor-air-quality.html';
  }

  if (slug.includes('ventilation') || slug.includes('erv') || slug.includes('hrv') || slug.includes('hood-vent')) {
    return 'ventilation.html';
  }

  if (slug.includes('duct-clean')) return 'air-duct-cleaning.html';
  if (slug.includes('ductless')) return 'ductless.html';
  if (slug.includes('duct')) return 'ductwork.html';

  if (slug.includes('heat-pump')) return 'heat-pump.html';
  if (slug.includes('thermostat')) return 'thermostats.html';
  if (slug.includes('gas-lines')) return 'gas-lines.html';

  if (slug.includes('energy') || slug.includes('efficiency')) return 'energy-efficiency.html';

  const isAc = /(^|-)ac(-|$)|air-condition|air-conditioner/.test(slug);
  if (isAc) {
    if (slug.includes('tune-up')) return 'ac-tune-up.html';
    if (slug.includes('maintenance') || slug.includes('summer') || slug.includes('ready-for-summer')) return 'ac-maintenance.html';
    if (slug.includes('replacement')) return 'ac-replacement.html';
    if (includesAny(slug, AC_REPAIR_FRAGMENTS)) return 'ac-repair.html';
    return 'air-conditioning.html';
  }

  if (slug.includes('furnace') || slug.includes('heater') || slug.includes('heating')) {
    if (slug.includes('tune-up')) return 'heating-tune-up.html';
    if (includesAny(slug, HEATING_MAINTENANCE_FRAGMENTS)) return 'heating-maintenance.html';
    if (slug.includes('replacement')) return 'heating-replacement.html';
    if (slug.includes('install')) return 'heating-installation.html';
    if (includesAny(slug, HEATING_REPAIR_FRAGMENTS)) return 'furnace-repair.html';
    return 'heating-services.html';
  }

  if (slug.includes('faq')) return 'faq.html';

  return null;
}

function addRedirect(redirects, source, destination, reason) {
  if (!source || source === destination || redirects.has(source)) return;
  redirects.set(source, { source, destination, permanent: true, reason });
}

function sourceVariantsFromSlug(slug) {
  if (!slug) return [];
  const base = pathnameFromSlug(slug);
  return base.endsWith('/') ? [base] : [base, `${base}/`];
}

export function buildRedirectPlan({ liveUrls, optionFiles }) {
  const redirects = new Map();

  for (const url of liveUrls) {
    const pathname = new URL(url).pathname;
    const slug = slugFromPathname(pathname);
    const destinationFile = buildLegacyDestination(slug, optionFiles);
    if (!destinationFile || destinationFile === 'index.html') continue;

    for (const source of sourceVariantsFromSlug(slug)) {
      addRedirect(redirects, source, `/${destinationFile}`, 'legacy-live-route');
    }
  }

  for (const file of [...optionFiles].sort()) {
    if (file === 'index.html') continue;
    const slug = file.replace(/\.html$/i, '');
    for (const source of sourceVariantsFromSlug(slug)) {
      addRedirect(redirects, source, `/${file}`, 'clean-option-route');
    }
  }

  return [...redirects.values()].sort((left, right) => left.source.localeCompare(right.source));
}

export function destinationSlug(destination) {
  return path.basename(destination).replace(/\.html$/i, '');
}
