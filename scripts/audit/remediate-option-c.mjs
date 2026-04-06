import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = process.cwd();
const targetRoot = path.join(repoRoot, 'option-c');
const donorPath = path.join(targetRoot, 'contact.html');
const logoPreloadLink = '    <link rel="preload" as="image" href="images/air-logo.webp" type="image/webp" fetchpriority="high">';

function normalizeLogoMarkup(html) {
  return html.replace(/<img\b([^>]*\bsrc=["']images\/air-logo\.webp["'][^>]*)>/gi, (match, attributes) => {
    const normalizedAttributes = attributes
      .replace(/\s+(fetchpriority|loading|decoding)="[^"]*"/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return `<img ${normalizedAttributes} fetchpriority="high" loading="eager" decoding="async">`;
  });
}

function normalizeHeadAssets(html) {
  let normalized = html;

  normalized = normalized.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/gi, '\n');
  normalized = normalized.replace(/\s*<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/gi, '\n');
  normalized = normalized.replace(/\s*<link href="https:\/\/fonts\.googleapis\.com\/css2[^"]+" rel="stylesheet">\s*/gi, '\n');
  normalized = normalized.replace(/\s*<link rel="preload" as="image" href="images\/air-logo\.webp" type="image\/webp" fetchpriority="high">\s*/gi, '\n');

  if (/<link rel="icon" href="favicon\.ico" sizes="32x32">/i.test(normalized)) {
    normalized = normalized.replace(
      /(\s*<link rel="icon" href="favicon\.ico" sizes="32x32">)/i,
      `\n${logoPreloadLink}\n\n$1`
    );
  } else if (/<link rel="stylesheet" href="styles\.css">/i.test(normalized)) {
    normalized = normalized.replace(
      /(\s*<link rel="stylesheet" href="styles\.css">)/i,
      `\n${logoPreloadLink}\n\n$1`
    );
  }

  return normalized;
}

function stripGoogleTagManager(html) {
  return html
    .replace(
      /\s*<!-- Google Tag Manager -->[\s\S]*?<!-- End Google Tag Manager -->\s*/gi,
      '\n'
    )
    .replace(
      /\s*<!-- Google Tag Manager \(noscript\) -->[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->\s*/gi,
      '\n'
    )
    .replace(
      /\s*<script>\s*\(function\(w,d,s,l,i\)\{w\[l\]=w\[l\]\|\|\[\];w\[l\]\.push\(\{'gtm\.start'[\s\S]*?GTM-WJ42DHD['"]\);<\/script>\s*/gi,
      '\n'
    )
    .replace(
      /\s*<noscript><iframe[^>]*src=["']https:\/\/www\.googletagmanager\.com\/ns\.html\?id=GTM-WJ42DHD["'][\s\S]*?<\/iframe><\/noscript>\s*/gi,
      '\n'
    );
}

const donorHtml = normalizeLogoMarkup(await fs.readFile(donorPath, 'utf8'));
const standardHeader = donorHtml.match(/<header>[\s\S]*?<\/header>/i)?.[0];
const standardFooter = donorHtml.match(/<footer>[\s\S]*?<\/footer>/i)?.[0];

if (!standardHeader || !standardFooter) {
  throw new Error('Unable to extract standard header/footer from option-c/contact.html');
}

const files = (await fs.readdir(targetRoot)).filter((file) => file.endsWith('.html')).sort();

let updatedCount = 0;

for (const file of files) {
  const fullPath = path.join(targetRoot, file);
  let html = await fs.readFile(fullPath, 'utf8');
  const original = html;
  const firstFooterMatch = html.match(/<footer[\s\S]*?<\/footer>/i);
  const firstFooter = firstFooterMatch?.[0] || '';

  html = html.replaceAll('https://option-c-nine.vercel.app', 'https://www.airexpresshvac.net');
  html = html.replaceAll('href="images/favicon.ico"', 'href="favicon.ico"');
  html = html.replaceAll("href='images/favicon.ico'", "href='favicon.ico'");
  html = html.replace(/<main((?=[^>]*\bid=["']main["'])[^>]*)>/i, (match, attributes) => {
    if (/tabindex=/i.test(attributes)) return match;
    return `<main${attributes} tabindex="-1">`;
  });

  html = html.replace(
    /<a href="#" class="review-link">Google Reviews<\/a>/g,
    '<a href="https://g.page/r/CYZKv5H3bwNzEBM/review" target="_blank" rel="noopener noreferrer" class="review-link">Google Reviews</a>'
  );
  html = html.replace(
    /<a href="#" class="review-link">Facebook Reviews<\/a>/g,
    '<a href="https://www.facebook.com/airexpresshvac/" target="_blank" rel="noopener noreferrer" class="review-link">Facebook Reviews</a>'
  );
  html = html.replaceAll(
    'href="https://www.google.com/search?q=Air+Express+HVAC"',
    'href="https://g.page/r/CYZKv5H3bwNzEBM/review"'
  );

  if (/^\s*<header>\s*<\/header>/im.test(html)) {
    html = html.replace(/<header>\s*<\/header>/i, standardHeader);
  }

  if (!/<header[\s>]/i.test(html) && html.includes('<div class="header-content">') && html.includes('</header>')) {
    html = html.replace('<div class="header-content">', `<header>\n        <div class="header-content">`);
  }

  if ((/footer-container|footer-column/i.test(firstFooter) || /href=["']\/[^"']+/i.test(firstFooter)) && !/<footer role="contentinfo">/i.test(html)) {
    html = html.replace(/<footer[\s\S]*?<\/footer>/i, standardFooter);
  }

  html = html.replace(
    /<footer[\s\S]*?(?=<footer role="contentinfo">)/gi,
    ''
  );

  html = html.replace(
    /<script>\s*\(function\(\)\s*\{[\s\S]*?var toggle = document\.querySelector\('\.nav-toggle'\);[\s\S]*?<\/script>\s*/gi,
    ''
  );

  html = normalizeHeadAssets(html);
  html = stripGoogleTagManager(html);
  html = normalizeLogoMarkup(html);

  if (html !== original) {
    await fs.writeFile(fullPath, html);
    updatedCount += 1;
  }
}

console.log(`Remediated ${updatedCount} option-c pages`);
