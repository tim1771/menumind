#!/usr/bin/env node
// Generates static HTML pages for the MenuMind blog from markdown files
// under blog/posts/ (and blog/posts/fr/ for French). Uses scripts/partials.js
// for shared chrome.

const fs = require('fs');
const path = require('path');
const {
  SITE_URL,
  BASE_CSS,
  LABELS,
  escapeHtml,
  escapeAttr,
  navHtml,
  footerHtml,
  ctaHtml,
} = require('./partials');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR_EN = path.join(ROOT, 'blog', 'posts');
const POSTS_DIR_FR = path.join(ROOT, 'fr', 'blog', 'posts');
const BLOG_DIR_EN = path.join(ROOT, 'blog');
const BLOG_DIR_FR = path.join(ROOT, 'fr', 'blog');

// Posts in newest-first order. Same slugs used for EN and FR.
// To add a post: write blog/posts/<slug>.md, then add { slug, date } here.
const ORDER = [
  { slug: 'ai-staff-scheduling-restaurants',       date: '2026-06-10' },
  { slug: 'ai-catering-quotes-restaurants',        date: '2026-06-03' },
  { slug: 'ai-menu-pricing-inflation-restaurants', date: '2026-05-27' },
  { slug: 'ai-loyalty-program-restaurants',        date: '2026-05-23' },
  { slug: 'ai-training-videos-restaurants',        date: '2026-05-21' },
  { slug: 'ai-social-media-restaurants',           date: '2026-05-20' },
  { slug: 'ai-food-waste-inventory-restaurants',   date: '2026-05-13' },
  { slug: 'ai-review-response-restaurants',        date: '2026-05-06' },
  { slug: 'restaurant-staff-ai-adoption',          date: '2026-04-29' },
  { slug: 'canadian-ai-privacy-restaurants',       date: '2026-04-22' },
];

// ── Markdown parser ───────────────────────────────────────────────────────
// Supports: # h1, ## h2, **bold**, [text](url), blank-line paragraphs.

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const isExternal = /^https?:\/\//i.test(url) && !url.includes('menumindx.netlify.app');
    const attrs = isExternal ? ` target="_blank" rel="noopener noreferrer"` : '';
    return `<a href="${escapeAttr(url)}"${attrs}>${label}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

function renderMarkdownBody(md) {
  const blocks = md.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    if (block.startsWith('## ')) {
      out.push(`<h2>${renderInline(block.slice(3).trim())}</h2>`);
    } else if (block.startsWith('# ')) {
      out.push(`<h2>${renderInline(block.slice(2).trim())}</h2>`);
    } else {
      out.push(`<p>${renderInline(block.replace(/\n/g, ' '))}</p>`);
    }
  }
  return out.join('\n');
}

// ── Frontmatter parser ────────────────────────────────────────────────────
// Format: title (`# ...`), then **Meta Description:** and **Target Keywords:**,
// then `---`, then body until the next `---`. The trailing CTA in the markdown
// is discarded — the rendered page gets a styled BlogCTA card instead.

function parsePost(md, lang) {
  const lines = md.split(/\r?\n/);
  let title = '';
  let metaDesc = '';
  let keywords = '';
  let i = 0;

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      i++;
      break;
    }
  }

  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') {
      i++;
      break;
    }
    const md1 = line.match(/^\*\*(?:Meta Description|Méta description|Description méta)\:\*\*\s*(.+)$/i);
    if (md1) { metaDesc = md1[1].trim(); continue; }
    const kw1 = line.match(/^\*\*(?:Target Keywords?|Mots-clés cibles?|Mots-cl[ée]s)\:\*\*\s*(.+)$/i);
    if (kw1) { keywords = kw1[1].trim(); continue; }
  }

  const bodyLines = [];
  for (; i < lines.length; i++) {
    if (lines[i].trim() === '---') break;
    bodyLines.push(lines[i]);
  }
  const body = bodyLines.join('\n').trim();

  return { title, metaDesc, keywords, body };
}

function readTime(body) {
  const words = body.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

function excerpt(s, n) {
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function fmtDate(iso, lang) {
  const [y, m, d] = iso.split('-').map(Number);
  if (lang === 'fr') {
    const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
    return `${d} ${months[m - 1]} ${y}`;
  }
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ── Per-page CSS ──────────────────────────────────────────────────────────

const LISTING_CSS = `
  .blog-hero {
    text-align: center;
    padding: 80px 24px 48px;
    max-width: 720px;
    margin: 0 auto;
  }
  .blog-hero .hero-badge {
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
  .blog-hero h1 {
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 800;
    line-height: 1.15;
    letter-spacing: -1px;
    margin-bottom: 16px;
  }
  .blog-hero h1 span { color: var(--accent); }
  .blog-hero p {
    color: var(--text-dim);
    font-size: 17px;
    max-width: 560px;
    margin: 0 auto;
  }
  .blog-grid-wrap { max-width: 1100px; margin: 0 auto; padding: 0 24px 80px; }
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
  .post-card h2 {
    font-size: 18px;
    font-weight: 700;
    color: var(--text);
    line-height: 1.3;
    margin-bottom: 12px;
  }
  .post-card p {
    font-size: 14px;
    color: var(--text-dim);
    line-height: 1.5;
    margin-bottom: 16px;
    flex: 1;
  }
  .post-card .read-more { color: var(--accent); font-weight: 600; font-size: 14px; }
  @media (max-width: 640px) {
    nav.site-nav { padding: 12px 16px; }
    .blog-hero { padding: 48px 16px 32px; }
    .blog-grid-wrap { padding: 0 16px 60px; }
    .blog-cta { padding: 24px; margin: 32px 0; }
  }
`;

const POST_CSS = `
  .post-wrap { max-width: 720px; margin: 0 auto; padding: 32px 24px 80px; }
  .back-link {
    display: inline-block;
    color: var(--text-dim);
    text-decoration: none;
    font-size: 14px;
    margin-bottom: 32px;
    transition: color 0.2s;
  }
  .back-link:hover { color: var(--accent); }
  .post-header {
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 1px solid var(--border);
  }
  .post-header h1 {
    font-size: clamp(26px, 4.5vw, 36px);
    font-weight: 800;
    line-height: 1.2;
    letter-spacing: -0.5px;
    margin-bottom: 16px;
    color: var(--text);
  }
  .post-meta {
    font-size: 13px;
    color: var(--text-dim);
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
  }
  .post-meta .dot { color: var(--border); }
  .post-content { font-size: 17px; line-height: 1.75; color: #d8dae0; }
  .post-content h2 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text);
    margin-top: 40px;
    margin-bottom: 16px;
    line-height: 1.3;
  }
  .post-content p { margin-bottom: 20px; }
  .post-content strong { color: var(--text); font-weight: 700; }
  .post-content a {
    color: var(--accent);
    text-decoration: underline;
    text-decoration-color: rgba(245,158,11,0.4);
    text-underline-offset: 3px;
  }
  .post-content a:hover { text-decoration-color: var(--accent); }
  .post-nav {
    margin-top: 48px;
    padding-top: 32px;
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  .post-nav a {
    display: block;
    padding: 16px;
    background: rgba(255,255,255,0.02);
    border: 1px solid var(--border);
    border-radius: 10px;
    text-decoration: none;
    color: inherit;
    transition: border-color 0.2s;
  }
  .post-nav a:hover { border-color: rgba(245,158,11,0.35); }
  .post-nav .label {
    font-size: 12px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 6px;
  }
  .post-nav .title { font-size: 14px; font-weight: 600; color: var(--text); line-height: 1.4; }
  .post-nav .next { text-align: right; }
  .post-nav .empty { background: transparent; border: none; pointer-events: none; }
  @media (max-width: 640px) {
    nav.site-nav { padding: 12px 16px; }
    .post-wrap { padding: 24px 16px 60px; }
    .post-content { font-size: 16px; }
    .post-nav { grid-template-columns: 1fr; }
    .post-nav .next { text-align: left; }
  }
`;

// ── Page builders ─────────────────────────────────────────────────────────

function postPage(post, prev, next, lang) {
  const L = LABELS[lang];
  const title = `${post.title} — MenuMind`;
  const slugPath = lang === 'fr' ? `/fr/blog/${post.slug}.html` : `/blog/${post.slug}.html`;
  const englishUrl = `/blog/${post.slug}.html`;
  const frenchUrl = `/fr/blog/${post.slug}.html`;
  const url = `${SITE_URL}${slugPath}`;
  const backHref = lang === 'fr' ? '/fr/blog/' : '/blog/';

  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(post.metaDesc)}">
${post.keywords ? `<meta name="keywords" content="${escapeAttr(post.keywords)}">` : ''}
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23dc2626'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Arial,sans-serif' font-weight='800' font-size='20' fill='white'%3EM%3C/text%3E%3C/svg%3E">

<meta property="og:type" content="article">
<meta property="og:title" content="${escapeAttr(post.title)}">
<meta property="og:description" content="${escapeAttr(post.metaDesc)}">
<meta property="og:url" content="${url}">
<meta property="article:published_time" content="${post.date}">

<link rel="alternate" hreflang="en-CA" href="${SITE_URL}${englishUrl}">
<link rel="alternate" hreflang="fr-CA" href="${SITE_URL}${frenchUrl}">

<style>${BASE_CSS}${POST_CSS}</style>
</head>
<body>
${navHtml({ lang, englishUrl, frenchUrl })}

<main class="post-wrap">
  <a href="${backHref}" class="back-link">${L.backToBlog}</a>

  <header class="post-header">
    <h1>${escapeHtml(post.title)}</h1>
    <div class="post-meta">
      <span>${fmtDate(post.date, lang)}</span>
      <span class="dot">·</span>
      <span>${post.readMin} ${L.minRead}</span>
    </div>
  </header>

  <article class="post-content">
${post.bodyHtml}
  </article>

  ${ctaHtml({ lang })}

  <nav class="post-nav">
    ${prev
      ? `<a href="${lang === 'fr' ? '/fr' : ''}/blog/${prev.slug}.html" class="prev"><div class="label">${lang === 'fr' ? '← Précédent' : '← Previous'}</div><div class="title">${escapeHtml(prev.title)}</div></a>`
      : `<div class="empty"></div>`}
    ${next
      ? `<a href="${lang === 'fr' ? '/fr' : ''}/blog/${next.slug}.html" class="next"><div class="label">${lang === 'fr' ? 'Suivant →' : 'Next →'}</div><div class="title">${escapeHtml(next.title)}</div></a>`
      : `<div class="empty"></div>`}
  </nav>
</main>

${footerHtml({ lang })}
</body>
</html>
`;
}

function listingPage(posts, lang) {
  const L = LABELS[lang];
  const isFr = lang === 'fr';
  const title = isFr ? 'Perspectives IA pour restaurants — Blogue MenuMind' : 'Restaurant AI Insights — MenuMind Blog';
  const desc = isFr
    ? 'Conseils et guides pratiques sur l\'IA pour propriétaires de restaurants indépendants au Canada.'
    : 'AI insights and practical guides for independent restaurant owners. Menu engineering, marketplace economics, food waste, staff adoption, privacy law, and more.';
  const englishUrl = '/blog/';
  const frenchUrl = '/fr/blog/';
  const url = `${SITE_URL}${isFr ? frenchUrl : englishUrl}`;
  const badge = isFr ? 'Blogue MenuMind' : 'MenuMind Blog';
  const heroTitle = isFr ? 'IA pour <span>restaurants</span>' : 'Restaurant <span>AI Insights</span>';
  const heroBlurb = isFr
    ? 'Guides pratiques pour propriétaires de restaurants indépendants — ingénierie de menu, économie des plateformes, adoption de l\'IA et tactiques concrètes qui améliorent les marges.'
    : 'Practical guides for independent restaurant owners — menu engineering, marketplace economics, AI adoption, and the real-world plays that move margin.';

  const cards = posts.map(p => `
    <a href="${isFr ? '/fr' : ''}/blog/${p.slug}.html" class="post-card">
      <div class="meta">${fmtDate(p.date, lang)} · ${p.readMin} ${L.minRead}</div>
      <h2>${escapeHtml(p.title)}</h2>
      <p>${escapeHtml(excerpt(p.metaDesc, 120))}</p>
      <div class="read-more">${L.readMore}</div>
    </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(desc)}">
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23dc2626'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Arial,sans-serif' font-weight='800' font-size='20' fill='white'%3EM%3C/text%3E%3C/svg%3E">

<meta property="og:type" content="website">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(desc)}">
<meta property="og:url" content="${url}">

<link rel="alternate" hreflang="en-CA" href="${SITE_URL}${englishUrl}">
<link rel="alternate" hreflang="fr-CA" href="${SITE_URL}${frenchUrl}">

<style>${BASE_CSS}${LISTING_CSS}</style>
</head>
<body>
${navHtml({ lang, englishUrl, frenchUrl })}

<section class="blog-hero">
  <div class="hero-badge">${badge}</div>
  <h1>${heroTitle}</h1>
  <p>${heroBlurb}</p>
</section>

<div class="blog-grid-wrap">
  <div class="blog-grid">
${cards}
  </div>

  ${ctaHtml({ lang })}
</div>

${footerHtml({ lang })}
</body>
</html>
`;
}

function homepageTeaser(posts, lang) {
  const top3 = posts.slice(0, 3);
  const L = LABELS[lang];
  const isFr = lang === 'fr';
  const sectionTitle = isFr ? 'Sur le blogue' : 'From Our Blog';
  const sectionSub = isFr
    ? 'Conseils et guides pratiques sur l\'IA pour propriétaires de restaurants indépendants.'
    : 'AI insights and practical guides for independent restaurant owners.';
  const viewAll = isFr ? 'Voir tous les articles →' : 'View All Posts →';
  const blogHref = isFr ? '/fr/blog/' : '/blog/';
  const slugPrefix = isFr ? '/fr/blog/' : '/blog/';

  const cards = top3.map(p => `
      <a href="${slugPrefix}${p.slug}.html" class="blog-teaser-card">
        <div class="blog-teaser-meta">${fmtDate(p.date, lang)} · ${p.readMin} ${L.minRead}</div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(excerpt(p.metaDesc, 120))}</p>
        <span class="blog-teaser-link">${L.readMore}</span>
      </a>`).join('');
  return `
  <!-- ── FROM OUR BLOG (auto-generated by scripts/build-blog.js) ── -->
  <section class="blog-teaser-section">
    <h2>${sectionTitle}</h2>
    <p class="blog-teaser-sub">${sectionSub}</p>
    <div class="blog-teaser-grid">${cards}
    </div>
    <div class="blog-teaser-cta">
      <a href="${blogHref}" class="blog-teaser-viewall">${viewAll}</a>
    </div>
  </section>
`;
}

// ── Build one language ────────────────────────────────────────────────────

function buildLang(lang) {
  const postsDir = lang === 'fr' ? POSTS_DIR_FR : POSTS_DIR_EN;
  const outDir = lang === 'fr' ? BLOG_DIR_FR : BLOG_DIR_EN;
  if (!fs.existsSync(postsDir)) {
    console.log(`[${lang}] Skipped: no posts directory at ${postsDir}`);
    return null;
  }

  const posts = [];
  for (const { slug, date } of ORDER) {
    const file = path.join(postsDir, `${slug}.md`);
    if (!fs.existsSync(file)) {
      console.log(`[${lang}] Missing ${slug}.md — skipping`);
      continue;
    }
    const md = fs.readFileSync(file, 'utf8');
    const parsed = parsePost(md, lang);
    posts.push({
      slug,
      date,
      title: parsed.title,
      metaDesc: parsed.metaDesc,
      keywords: parsed.keywords,
      body: parsed.body,
      bodyHtml: renderMarkdownBody(parsed.body),
      readMin: readTime(parsed.body),
    });
  }

  if (!posts.length) {
    console.log(`[${lang}] No posts found — skipping build`);
    return null;
  }

  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'index.html'), listingPage(posts, lang), 'utf8');
  console.log(`[${lang}] Wrote ${path.relative(ROOT, outDir)}/index.html`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const olderPost = posts[i + 1] || null;
    const newerPost = posts[i - 1] || null;
    const html = postPage(post, olderPost, newerPost, lang);
    fs.writeFileSync(path.join(outDir, `${post.slug}.html`), html, 'utf8');
    console.log(`[${lang}] Wrote ${path.relative(ROOT, outDir)}/${post.slug}.html`);
  }

  fs.writeFileSync(path.join(outDir, '_homepage-teaser.html'), homepageTeaser(posts, lang), 'utf8');
  console.log(`[${lang}] Wrote ${path.relative(ROOT, outDir)}/_homepage-teaser.html`);

  return { lang, posts };
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  const en = buildLang('en');
  const fr = buildLang('fr');
  const total = (en ? en.posts.length : 0) + (fr ? fr.posts.length : 0);
  console.log(`\nGenerated ${total} pages total (EN: ${en ? en.posts.length : 0}, FR: ${fr ? fr.posts.length : 0}).`);
}

if (require.main === module) main();

module.exports = { buildLang, ORDER };
