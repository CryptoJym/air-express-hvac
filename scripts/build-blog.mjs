#!/usr/bin/env node
/**
 * build-blog.mjs
 *
 * Static blog build step for Air Express HVAC.
 *
 * Reads all markdown files from `content/blog/*.md`, parses frontmatter,
 * renders markdown to HTML, wraps in the blog-post template, and writes
 * `blog/<slug>.html` for each post. Also generates:
 *   - blog/index.html (aliased from resources.html template for SEO)
 *   - blog/rss.xml (RSS 2.0 feed)
 *
 * The build is idempotent and runs on every Vercel deploy via the
 * `vercel-build` script in package.json.
 *
 * Markdown frontmatter schema (YAML):
 *   title:      string, required
 *   slug:       string, required (lowercase-kebab-case, no spaces)
 *   date:       ISO date string, required (YYYY-MM-DD)
 *   author:     string, default "The Air Express Team"
 *   category:   string, default "Field Notes"
 *   excerpt:    string, required (~160 chars, used for SEO description)
 *   image:      absolute path from repo root, required (/images/foo.webp)
 *   tags:       array of strings, optional
 *   draft:      boolean, default false (drafts are skipped in production)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import matter from "gray-matter";
import { marked } from "marked";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const CONTENT_DIR = path.join(ROOT, "content", "blog");
const BLOG_OUT_DIR = path.join(ROOT, "blog");
const TEMPLATE_POST = path.join(ROOT, "templates", "blog-post.html");
const TEMPLATE_INDEX = path.join(ROOT, "templates", "blog-index.html");
const RESOURCES_HTML = path.join(ROOT, "resources.html");
const SITEMAP_XML = path.join(ROOT, "sitemap.xml");

const SITE_URL = "https://www.airexpresshvac.net";
const SITE_NAME = "Air Express HVAC";
const FEED_TITLE = "Air Express HVAC — Field Notes";
const FEED_DESCRIPTION =
  "Utah-specific heating and cooling advice from the Air Express HVAC team in Lehi.";

// Configure marked for plain, semantic HTML output
marked.setOptions({
  gfm: true,
  breaks: false,
  headerIds: true,
  mangle: false,
});

/**
 * Read a single markdown file and return parsed post metadata + rendered body.
 * Returns null if the post is marked draft in production.
 */
function readPost(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  const parsed = matter(raw);
  const fm = parsed.data;

  if (fm.draft === true && process.env.NODE_ENV === "production") {
    return null;
  }

  // Validate required fields
  const required = ["title", "slug", "date", "excerpt", "image"];
  for (const key of required) {
    if (!fm[key]) {
      throw new Error(
        `Missing required frontmatter key "${key}" in ${path.basename(
          filePath
        )}`
      );
    }
  }

  const bodyHtml = marked.parse(parsed.content);
  const dateObj = new Date(fm.date);
  const isoDate = dateObj.toISOString();
  const displayDate = dateObj.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const readTime = Math.max(
    1,
    Math.round(parsed.content.split(/\s+/).length / 220)
  );

  return {
    title: fm.title,
    slug: fm.slug,
    date: fm.date,
    isoDate,
    displayDate,
    author: fm.author || "The Air Express Team",
    category: fm.category || "Field Notes",
    excerpt: fm.excerpt,
    image: fm.image,
    tags: Array.isArray(fm.tags) ? fm.tags : [],
    readTime,
    body: bodyHtml,
    rawBody: parsed.content,
  };
}

/**
 * Rewrite relative URLs in extracted chrome to absolute paths so they work
 * from inside the /blog/ subdirectory. Without this, `href="about.html"`
 * resolves to `/blog/about.html` and breaks navigation.
 */
function rewriteRelativeUrls(html) {
  return html
    // href="foo.html" or href="foo/bar.html"  →  href="/foo.html"
    .replace(
      /(\shref=")(?!https?:\/\/|\/|#|mailto:|tel:|javascript:)([^"]+\.html)"/g,
      '$1/$2"'
    )
    // src="images/foo.webp" → src="/images/foo.webp"
    .replace(
      /(\ssrc=")(?!https?:\/\/|\/|data:)(images\/[^"]+)"/g,
      '$1/$2"'
    )
    // href="images/..." (rare, but happens with some icon refs)
    .replace(
      /(\shref=")(?!https?:\/\/|\/|#)(images\/[^"]+)"/g,
      '$1/$2"'
    );
}

/**
 * Extract the <header> and <footer> from an existing site page so blog posts
 * get the same nav + footer automatically, no duplication. URLs inside the
 * chrome are rewritten to absolute paths so they work from /blog/<slug>.html.
 */
function extractSiteChrome() {
  const sample = fs.readFileSync(path.join(ROOT, "contact.html"), "utf8");

  const headerMatch = sample.match(/<header>[\s\S]*?<\/header>/);
  const footerMatch = sample.match(/<footer>[\s\S]*?<\/footer>/);

  if (!headerMatch || !footerMatch) {
    throw new Error(
      "Could not extract <header>/<footer> from contact.html — site chrome missing?"
    );
  }

  return {
    header: rewriteRelativeUrls(headerMatch[0]),
    footer: rewriteRelativeUrls(footerMatch[0]),
  };
}

/**
 * Simple {{placeholder}} replacement. Escapes are not needed here because
 * frontmatter values are author-controlled, not user input.
 */
function fillTemplate(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (data[key] === undefined || data[key] === null) return "";
    return String(data[key]);
  });
}

function renderPostCard(post) {
  return `
            <article class="blog-card">
                <a class="blog-card-image" href="/blog/${post.slug}.html" aria-hidden="true" tabindex="-1">
                    <img src="${post.image}" alt="" loading="lazy">
                </a>
                <div class="blog-card-body">
                    <p class="blog-card-meta">${post.category} · ${post.readTime} min read</p>
                    <h2 class="blog-card-title"><a href="/blog/${post.slug}.html">${post.title}</a></h2>
                    <p class="blog-card-excerpt">${post.excerpt}</p>
                    <p class="blog-card-footer">
                        <span class="blog-card-author">${post.author}</span>
                        <time datetime="${post.isoDate}">${post.displayDate}</time>
                    </p>
                </div>
            </article>`;
}

function generateRss(posts) {
  const items = posts
    .map((post) => {
      return `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${SITE_URL}/blog/${post.slug}.html</link>
      <guid>${SITE_URL}/blog/${post.slug}.html</guid>
      <pubDate>${new Date(post.date).toUTCString()}</pubDate>
      <description><![CDATA[${post.excerpt}]]></description>
      <author>noreply@airexpresshvac.net (${post.author})</author>
      <category>${post.category}</category>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${FEED_TITLE}</title>
    <link>${SITE_URL}/resources.html</link>
    <description>${FEED_DESCRIPTION}</description>
    <language>en-us</language>
    <atom:link href="${SITE_URL}/blog/rss.xml" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>
`;
}

function main() {
  if (!fs.existsSync(CONTENT_DIR)) {
    console.log(
      `[build-blog] No content directory at ${CONTENT_DIR}, nothing to build.`
    );
    return;
  }

  // Load templates
  const postTemplate = fs.readFileSync(TEMPLATE_POST, "utf8");
  const indexTemplate = fs.readFileSync(TEMPLATE_INDEX, "utf8");

  // Extract nav + footer from an existing page so we inherit the current
  // brand chrome without duplicating markup.
  const chrome = extractSiteChrome();

  // Read all markdown posts
  const files = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"));

  const posts = files
    .map((f) => readPost(path.join(CONTENT_DIR, f)))
    .filter(Boolean)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  console.log(`[build-blog] Found ${posts.length} post(s).`);

  // Ensure output dir
  fs.mkdirSync(BLOG_OUT_DIR, { recursive: true });

  // Render each post
  for (const post of posts) {
    const html = fillTemplate(postTemplate, {
      ...post,
      header: chrome.header,
      footer: chrome.footer,
    });
    const outPath = path.join(BLOG_OUT_DIR, `${post.slug}.html`);
    fs.writeFileSync(outPath, html);
    console.log(`[build-blog] ✓ ${post.slug}.html`);
  }

  // Render the blog index into both blog/index.html AND resources.html
  // (resources.html is the existing entry point users already know about)
  const postCards = posts.map(renderPostCard).join("\n");
  const indexHtml = fillTemplate(indexTemplate, {
    postCards,
    header: chrome.header,
    footer: chrome.footer,
  });
  fs.writeFileSync(path.join(BLOG_OUT_DIR, "index.html"), indexHtml);
  fs.writeFileSync(RESOURCES_HTML, indexHtml);
  console.log(`[build-blog] ✓ blog/index.html + resources.html`);

  // RSS
  const rss = generateRss(posts);
  fs.writeFileSync(path.join(BLOG_OUT_DIR, "rss.xml"), rss);
  console.log(`[build-blog] ✓ blog/rss.xml`);

  // Update sitemap with blog post URLs (append-only, idempotent)
  if (fs.existsSync(SITEMAP_XML)) {
    let sitemap = fs.readFileSync(SITEMAP_XML, "utf8");
    const blogUrls = posts
      .map(
        (post) => `  <url>
    <loc>${SITE_URL}/blog/${post.slug}.html</loc>
    <lastmod>${post.date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
      )
      .join("\n");

    // Remove any prior auto-generated block before inserting new one
    sitemap = sitemap.replace(
      /\s*<!-- BLOG_POSTS_START -->[\s\S]*?<!-- BLOG_POSTS_END -->/,
      ""
    );
    sitemap = sitemap.replace(
      "</urlset>",
      `\n  <!-- BLOG_POSTS_START -->\n${blogUrls}\n  <!-- BLOG_POSTS_END -->\n</urlset>`
    );
    fs.writeFileSync(SITEMAP_XML, sitemap);
    console.log(`[build-blog] ✓ sitemap.xml updated`);
  }

  console.log(`[build-blog] Done.`);
}

try {
  main();
} catch (err) {
  console.error(`[build-blog] ERROR: ${err.message}`);
  process.exit(1);
}
