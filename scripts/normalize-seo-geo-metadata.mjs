#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const defaultImage = "https://airexpressutah.com/images/og-card-utah.webp";

const descriptionOverrides = new Map([
  [
    "ducting.html",
    "Ducting and ductwork services in Lehi, UT from Air Express HVAC, including airflow checks, duct repair, and comfort fixes for Utah County homes.",
  ],
  [
    "other-products.html",
    "HVAC products and accessories in Lehi, UT from Air Express HVAC, including thermostats, filters, humidifiers, air cleaners, and comfort upgrades.",
  ],
  [
    "other-services-tests.html",
    "HVAC testing and additional services in Lehi, UT from Air Express HVAC, including airflow, safety, comfort, and system performance checks.",
  ],
  [
    "other-services.html",
    "Additional HVAC services from Air Express HVAC in Lehi, UT, including comfort troubleshooting, specialty repairs, and system support.",
  ],
  [
    "privacy-policy.html",
    "Air Express HVAC privacy policy for website visitors, estimate requests, service forms, and communications with our Lehi, Utah team.",
  ],
  [
    "request-estimate.html",
    "Request a free HVAC estimate from Air Express HVAC in Lehi, UT for AC, furnace, heat pump, maintenance, and indoor air quality work.",
  ],
  [
    "schedule-service.html",
    "Schedule HVAC service with Air Express HVAC in Lehi, UT for AC repair, heating repair, maintenance, tune-ups, and comfort issues.",
  ],
]);

function htmlFiles() {
  const rootHtml = fs.readdirSync(root)
    .filter((file) => file.endsWith(".html") && file !== "404.html");
  const blogDir = path.join(root, "blog");
  const blogHtml = fs.existsSync(blogDir)
    ? fs.readdirSync(blogDir)
      .filter((file) => file.endsWith(".html"))
      .map((file) => `blog/${file}`)
    : [];
  return [...rootHtml, ...blogHtml].sort();
}

function escapeAttr(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function extractAttr(tag, name) {
  const quoted = new RegExp(`${name}\\s*=\\s*(["'])(.*?)\\1`, "i").exec(tag);
  return quoted?.[2] || "";
}

function metaTag(html, name) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  return tags.find((tag) => extractAttr(tag, "name").toLowerCase() === name.toLowerCase()) || "";
}

function propertyTag(html, property) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map((match) => match[0]);
  return tags.find((tag) => extractAttr(tag, "property").toLowerCase() === property.toLowerCase()) || "";
}

function metaContent(html, name) {
  const tag = metaTag(html, name);
  return tag ? extractAttr(tag, "content").trim() : "";
}

function propertyContent(html, property) {
  const tag = propertyTag(html, property);
  return tag ? extractAttr(tag, "content").trim() : "";
}

function titleContent(html) {
  return (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceMetaName(html, name, content) {
  const tag = metaTag(html, name);
  if (!tag) return html;
  const nextTag = tag.replace(/content\s*=\s*(["'])(.*?)\1/i, `content="${escapeAttr(content)}"`);
  return html.replace(tag, nextTag);
}

function replaceMetaProperty(html, property, content) {
  const tag = propertyTag(html, property);
  if (!tag) return html;
  const nextTag = tag.replace(/content\s*=\s*(["'])(.*?)\1/i, `content="${escapeAttr(content)}"`);
  return html.replace(tag, nextTag);
}

function socialBlock({ title, description, image }) {
  return `    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(title)}">
    <meta name="twitter:description" content="${escapeAttr(description)}">
    <meta name="twitter:image" content="${escapeAttr(image || defaultImage)}">`;
}

function insertTwitterTags(html, file) {
  if (metaContent(html, "twitter:card")) return html;

  const title = propertyContent(html, "og:title") || titleContent(html) || "Air Express HVAC";
  const description =
    propertyContent(html, "og:description") ||
    metaContent(html, "description") ||
    "Air Express HVAC serves Lehi, Utah County, and nearby Utah homes with heating, cooling, and indoor air quality service.";
  const image = propertyContent(html, "og:image") || defaultImage;
  const block = socialBlock({ title, description, image });

  const anchors = [
    /    <meta property="og:locale"[^>]*>\n/i,
    /    <meta property="og:site_name"[^>]*>\n/i,
    /    <meta property="og:url"[^>]*>\n/i,
  ];
  for (const anchor of anchors) {
    if (anchor.test(html)) {
      return html.replace(anchor, (match) => `${match}${block}\n`);
    }
  }

  return html.replace("</head>", `${block}\n</head>`);
}

function normalizeFile(file) {
  const fullPath = path.join(root, file);
  let html = fs.readFileSync(fullPath, "utf8");
  const original = html;
  const override = descriptionOverrides.get(file);

  if (override) {
    html = replaceMetaName(html, "description", override);
    html = replaceMetaProperty(html, "og:description", override);
    html = replaceMetaName(html, "twitter:description", override);
  }

  html = insertTwitterTags(html, file);

  if (html !== original) {
    fs.writeFileSync(fullPath, html);
    return true;
  }
  return false;
}

const changed = htmlFiles().filter(normalizeFile);

console.log(JSON.stringify({
  status: "normalized",
  changed: changed.length,
  files: changed,
}, null, 2));
