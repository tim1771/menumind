#!/usr/bin/env node
// Generates sitemap.xml at the site root. Pulls the blog post list from
// build-blog.js so the sitemap stays in sync with what actually gets
// generated. City pages come from build-cities.js.

const fs = require('fs');
const path = require('path');
const { ORDER } = require('./build-blog');
const { CITIES } = require('./build-cities');

const ROOT = path.resolve(__dirname, '..');
const SITE_URL = 'https://menumindx.netlify.app';
const TODAY = new Date().toISOString().slice(0, 10);

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`<url>`, `  <loc>${loc}</loc>`];
  if (lastmod) parts.push(`  <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`  <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`  <priority>${priority}</priority>`);
  parts.push(`</url>`);
  return parts.join('\n');
}

function build() {
  const entries = [];

  // ── Static pages ────────────────────────────────────────────────────
  entries.push({ loc: `${SITE_URL}/`,                                lastmod: TODAY, changefreq: 'monthly', priority: '1.0' });
  entries.push({ loc: `${SITE_URL}/marketplace-calculator.html`,     lastmod: TODAY, changefreq: 'monthly', priority: '0.9' });
  entries.push({ loc: `${SITE_URL}/about.html`,                      lastmod: TODAY, changefreq: 'monthly', priority: '0.7' });
  entries.push({ loc: `${SITE_URL}/blog/`,                           lastmod: TODAY, changefreq: 'weekly',  priority: '0.8' });
  entries.push({ loc: `${SITE_URL}/audit/`,                          lastmod: TODAY, changefreq: 'monthly', priority: '0.7' });

  // ── French static pages ─────────────────────────────────────────────
  if (fs.existsSync(path.join(ROOT, 'fr', 'index.html'))) {
    entries.push({ loc: `${SITE_URL}/fr/`,                              lastmod: TODAY, changefreq: 'monthly', priority: '0.9' });
  }
  if (fs.existsSync(path.join(ROOT, 'fr', 'marketplace-calculator.html'))) {
    entries.push({ loc: `${SITE_URL}/fr/marketplace-calculator.html`,   lastmod: TODAY, changefreq: 'monthly', priority: '0.8' });
  }
  if (fs.existsSync(path.join(ROOT, 'fr', 'about.html'))) {
    entries.push({ loc: `${SITE_URL}/fr/about.html`,                    lastmod: TODAY, changefreq: 'monthly', priority: '0.6' });
  }
  if (fs.existsSync(path.join(ROOT, 'fr', 'blog'))) {
    entries.push({ loc: `${SITE_URL}/fr/blog/`,                         lastmod: TODAY, changefreq: 'weekly',  priority: '0.7' });
  }

  // ── EN blog posts (one per .md file present) ────────────────────────
  for (const { slug, date } of ORDER) {
    if (fs.existsSync(path.join(ROOT, 'blog', 'posts', `${slug}.md`))) {
      entries.push({
        loc: `${SITE_URL}/blog/${slug}.html`,
        lastmod: date,
        changefreq: 'monthly',
        priority: '0.6',
      });
    }
  }

  // ── FR blog posts ───────────────────────────────────────────────────
  for (const { slug, date } of ORDER) {
    if (fs.existsSync(path.join(ROOT, 'fr', 'blog', 'posts', `${slug}.md`))) {
      entries.push({
        loc: `${SITE_URL}/fr/blog/${slug}.html`,
        lastmod: date,
        changefreq: 'monthly',
        priority: '0.5',
      });
    }
  }

  // ── City landing pages ──────────────────────────────────────────────
  for (const city of CITIES) {
    entries.push({
      loc: `${SITE_URL}/audit/${city.slug}.html`,
      lastmod: TODAY,
      changefreq: 'monthly',
      priority: '0.5',
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(urlEntry).join('\n')}
</urlset>
`;

  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml, 'utf8');
  console.log(`Wrote sitemap.xml (${entries.length} URLs)`);
}

if (require.main === module) build();

module.exports = { build };
