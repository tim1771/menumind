#!/usr/bin/env node
// Generates city landing pages at /audit/<city-slug>.html — one per Canadian
// metro. Programmatic SEO: each page targets "AI menu audit <city>" and
// similar local-intent searches, sharing chrome via scripts/partials.js.

const fs = require('fs');
const path = require('path');
const { SITE_URL, ORG_ID, BASE_CSS, navHtml, footerHtml, ctaHtml, escapeHtml, escapeAttr, seoMeta } = require('./partials');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'audit');

// One row per city. `flavor` is a short, plausible local color sentence — not
// invented stats, just observational. `cuisines` are the most common
// independent-restaurant categories in that metro (used in the body copy).
const CITIES = [
  { slug: 'toronto',     name: 'Toronto',       province: 'ON', cuisines: ['Italian','Korean','Indian','sushi','shawarma'], flavor: 'From King West bistros to Scarborough takeout counters, Toronto\'s independent operators face the highest delivery-platform saturation in the country.' },
  { slug: 'montreal',    name: 'Montreal',      province: 'QC', cuisines: ['French','Lebanese','Portuguese','smoked-meat','bistro'], flavor: 'Quebec\'s privacy rules and the bilingual menu reality make menu engineering a particularly nuanced exercise in Montreal.' },
  { slug: 'vancouver',   name: 'Vancouver',     province: 'BC', cuisines: ['ramen','sushi','dim sum','Pacific Northwest','vegan'], flavor: 'Vancouver\'s rent-to-revenue ratios are some of the toughest in Canada, which makes margin-per-item analysis especially valuable.' },
  { slug: 'calgary',     name: 'Calgary',       province: 'AB', cuisines: ['steakhouse','brunch','Vietnamese','BBQ','Indian'], flavor: 'Calgary\'s commodity-driven economy means menu pricing has to adapt quickly to shifts in disposable income.' },
  { slug: 'edmonton',    name: 'Edmonton',      province: 'AB', cuisines: ['comfort','Filipino','Ethiopian','Chinese','steakhouse'], flavor: 'Edmonton\'s independent restaurants face long winters and seasonal traffic swings that demand careful menu planning.' },
  { slug: 'ottawa',      name: 'Ottawa',        province: 'ON', cuisines: ['Lebanese','Italian','shawarma','brunch','pub'], flavor: 'Ottawa\'s government-driven lunch demand and ByWard Market dinner scene create two distinct menu economies inside one city.' },
  { slug: 'mississauga', name: 'Mississauga',   province: 'ON', cuisines: ['Indian','Pakistani','Chinese','Polish','shawarma'], flavor: 'Mississauga\'s suburban independents compete with chain density that makes differentiation through menu storytelling essential.' },
  { slug: 'winnipeg',    name: 'Winnipeg',      province: 'MB', cuisines: ['Filipino','perogies','comfort','Chinese','BBQ'], flavor: 'Winnipeg\'s price-conscious diner base means menu engineering pays off fast — small price moves shift mix immediately.' },
  { slug: 'halifax',     name: 'Halifax',       province: 'NS', cuisines: ['seafood','donair','pub','brunch','Indian'], flavor: 'Halifax\'s seafood-driven menus and tourism seasonality reward operators who tune their offering month by month.' },
  { slug: 'quebec-city', name: 'Quebec City',   province: 'QC', cuisines: ['French','poutine','bistro','bakery','steakhouse'], flavor: 'Quebec City\'s old-town tourism economy and largely French-speaking customer base demand bilingual menu craft.' },
];

// ── CSS specific to the city landing pages ────────────────────────────────

const CITY_CSS = `
  .city-hero {
    text-align: center;
    padding: 80px 24px 48px;
    max-width: 760px;
    margin: 0 auto;
  }
  .city-hero .hero-badge {
    display: inline-block;
    padding: 5px 16px;
    border-radius: 20px;
    border: 1px solid rgba(245,158,11,0.4);
    background: rgba(245,158,11,0.08);
    color: var(--accent);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.04em;
    margin-bottom: 20px;
  }
  .city-hero h1 {
    font-size: clamp(28px, 5vw, 44px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -1px;
    margin-bottom: 16px;
  }
  .city-hero h1 span { color: var(--accent); }
  .city-hero p {
    color: var(--text-dim);
    font-size: 17px;
    max-width: 600px;
    margin: 0 auto 32px;
  }
  .city-cta {
    display: inline-block;
    background: linear-gradient(110deg, #f59e0b 0%, #ef4444 100%);
    color: #fff;
    font-weight: 700;
    font-size: 16px;
    padding: 14px 36px;
    border-radius: 12px;
    border: 2px solid var(--accent);
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 0 18px rgba(245,158,11,0.5);
  }
  .city-cta:hover {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 0 28px rgba(245,158,11,0.7);
  }

  .city-body {
    max-width: 760px;
    margin: 0 auto;
    padding: 0 24px 60px;
    font-size: 17px;
    line-height: 1.75;
    color: #d8dae0;
  }
  .city-body h2 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin-top: 48px;
    margin-bottom: 16px;
    line-height: 1.3;
  }
  .city-body p { margin-bottom: 20px; }
  .city-body strong { color: var(--text); }
  .city-body a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(245,158,11,0.4);
    text-underline-offset: 3px;
  }

  .city-cuisines {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 24px 0 0;
    padding: 0;
    list-style: none;
  }
  .city-cuisines li {
    background: rgba(245,158,11,0.08);
    border: 1px solid rgba(245,158,11,0.25);
    color: var(--accent);
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 13px;
    font-weight: 600;
  }

  .city-cta-row {
    display: flex;
    gap: 16px;
    margin-top: 32px;
    flex-wrap: wrap;
  }
  .city-cta-row .secondary {
    color: var(--text-dim);
    text-decoration: none;
    align-self: center;
    font-size: 14px;
  }
  .city-cta-row .secondary:hover { color: var(--accent); }

  @media (max-width: 640px) {
    nav.site-nav { padding: 12px 16px; }
    .city-hero { padding: 48px 16px 32px; }
    .city-hero .city-cta { width: 100%; }
    .city-body { padding: 0 16px 40px; }
  }
`;

// ── Page assembly ─────────────────────────────────────────────────────────

function cityPage(city) {
  const title = `AI Menu Audit for ${city.name} Restaurants — MenuMind`;
  const description = `Free AI-powered menu audit and marketplace cost calculator built for independent restaurants in ${city.name}, ${city.province}. Get pricing, item-mix, and design recommendations in 60 seconds.`;
  const url = `${SITE_URL}/audit/${city.slug}.html`;

  // WebPage schema with about → City. Publisher references the canonical
  // Organization node by @id so the graph stays unified across pages.
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": title,
    "description": description,
    "url": url,
    "inLanguage": "en-CA",
    "about": {
      "@type": "City",
      "name": city.name,
      "containedInPlace": { "@type": "AdministrativeArea", "name": city.province + ', Canada' },
    },
    "publisher": { "@id": ORG_ID },
  };

  const cuisineList = city.cuisines.map(c => `<li>${escapeHtml(c)}</li>`).join('');

  const body = `
<section class="city-hero">
  <div class="hero-badge">${escapeHtml(city.name)} · ${city.province}</div>
  <h1>AI menu audit for ${escapeHtml(city.name)} <span>restaurants</span></h1>
  <p>A free, 60-second audit built for independent ${escapeHtml(city.name)} operators. Item-by-item pricing recommendations, menu-engineering classification, and a marketplace-fee calculator — no consultant required.</p>
  <a href="/" class="city-cta">Run a Free Audit</a>
</section>

<article class="city-body">
  <h2>Built for ${escapeHtml(city.name)}, not for chains</h2>
  <p>${escapeHtml(city.flavor)} MenuMind is a free tool designed for independent operators — not 200-location chains with their own analysts.</p>

  <h2>What the audit actually delivers</h2>
  <p>Upload a photo of your menu or paste the items as text. In about a minute you'll get a classification of every dish (Star, Plowhorse, Puzzle, Dog), pricing recommendations calibrated to your cuisine and food-cost target, and rewritten descriptions designed to lift average check size. The kind of analysis a consultant would charge several thousand for, generated on the fly.</p>

  <h2>Common ${escapeHtml(city.name)} cuisines we audit</h2>
  <p>Whatever you're cooking — these are the most common cuisines we see from operators in your area:</p>
  <ul class="city-cuisines">${cuisineList}</ul>

  <h2>Don't forget the marketplace math</h2>
  <p>Most ${escapeHtml(city.name)} independents are bleeding 25–35% of every Uber Eats, DoorDash, and Skip the Dishes order to fees. Before you optimize the menu, see what the platforms are costing you each month with our <a href="/marketplace-calculator.html">Direct vs. Marketplace Calculator</a>. Then run the menu audit to maximize what you keep on the orders you control.</p>

  <div class="city-cta-row">
    <a href="/" class="city-cta">Run a Free Audit</a>
    <a href="/marketplace-calculator.html" class="secondary">Or try the marketplace calculator →</a>
  </div>
</article>

<div style="max-width: 760px; margin: 0 auto; padding: 0 24px;">
${ctaHtml({ lang: 'en' })}
</div>
`;

  const head = seoMeta({
    title,
    description,
    canonical: url,
    lang: 'en',
    englishUrl: `/audit/${city.slug}.html`,
    frenchUrl: null,
    jsonLd: ld,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${head}
<style>${BASE_CSS}${CITY_CSS}</style>
</head>
<body>
${navHtml({ lang: 'en', englishUrl: `/audit/${city.slug}.html`, frenchUrl: '/fr/' })}
${body}
${footerHtml({ lang: 'en' })}
</body>
</html>
`;
}

function buildIndex(cities) {
  // /audit/ index linking to all city pages — a hub the homepage can link to.
  const cards = cities.map(c => `
    <a href="/audit/${c.slug}.html" class="post-card">
      <div class="meta">${escapeHtml(c.province)}</div>
      <h2>${escapeHtml(c.name)}</h2>
      <p>${escapeHtml(c.cuisines.slice(0, 3).join(', '))} and more — free AI menu audit and marketplace calculator.</p>
      <div class="read-more">Run the audit →</div>
    </a>`).join('\n');

  const body = `
<section class="city-hero">
  <div class="hero-badge">Local Editions</div>
  <h1>AI menu audits, <span>built for your city</span></h1>
  <p>Pick your city to start a free 60-second menu audit tailored to local cuisine and marketplace conditions.</p>
</section>

<div style="max-width:1100px;margin:0 auto;padding:0 24px 80px;">
  <div class="blog-grid">${cards}
  </div>
</div>
`;

  const title = 'AI Menu Audit — Local Editions — MenuMind';
  const description = 'Free AI menu audits and marketplace calculators tailored for independent restaurants in major Canadian cities.';
  const url = `${SITE_URL}/audit/`;

  // Reuse listing card styles inline.
  const indexCss = `
    .blog-grid { display: grid; grid-template-columns: 1fr; gap: 20px; }
    @media (min-width: 640px) { .blog-grid { grid-template-columns: 1fr 1fr; } }
    @media (min-width: 960px) { .blog-grid { grid-template-columns: 1fr 1fr 1fr; } }
    .post-card {
      background: rgba(255,255,255,0.02);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 24px;
      text-decoration: none;
      color: inherit;
      display: flex;
      flex-direction: column;
      transition: border-color 0.3s, box-shadow 0.3s, transform 0.2s;
    }
    .post-card:hover {
      border-color: rgba(245,158,11,0.35);
      box-shadow: 0 0 24px rgba(245,158,11,0.08);
      transform: translateY(-2px);
    }
    .post-card .meta {
      font-size: 12px;
      color: var(--text-dim);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 10px;
    }
    .post-card h2 { font-size: 20px; font-weight: 700; color: var(--text); margin-bottom: 8px; }
    .post-card p { font-size: 14px; color: var(--text-dim); line-height: 1.5; margin-bottom: 16px; flex:1; }
    .post-card .read-more { color: var(--accent); font-weight: 600; font-size: 14px; }
  `;

  const hubLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "name": title,
    "description": description,
    "url": url,
    "publisher": { "@id": ORG_ID },
    "inLanguage": "en-CA",
  };

  const head = seoMeta({
    title,
    description,
    canonical: url,
    lang: 'en',
    englishUrl: '/audit/',
    frenchUrl: null,
    jsonLd: hubLd,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
${head}
<style>${BASE_CSS}${CITY_CSS}${indexCss}</style>
</head>
<body>
${navHtml({ lang: 'en' })}
${body}
${footerHtml({ lang: 'en' })}
</body>
</html>
`;
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  for (const city of CITIES) {
    const html = cityPage(city);
    fs.writeFileSync(path.join(OUT_DIR, `${city.slug}.html`), html, 'utf8');
    console.log(`Wrote audit/${city.slug}.html`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), buildIndex(CITIES), 'utf8');
  console.log(`Wrote audit/index.html`);
  console.log(`\nGenerated ${CITIES.length} city pages + 1 hub page.`);
}

if (require.main === module) main();

module.exports = { CITIES };
