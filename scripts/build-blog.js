#!/usr/bin/env node
// Generates static HTML pages for the MenuMind blog from markdown files in blog/posts/.
// Vanilla Node, no external deps. Produces:
//   - blog/index.html              (listing)
//   - blog/<slug>.html             (one per post)
//   - blog/_homepage-teaser.html   (snippet inlined into the homepage)

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const POSTS_DIR = path.join(ROOT, 'blog', 'posts');
const BLOG_DIR = path.join(ROOT, 'blog');
const SITE_URL = 'https://menumindx.netlify.app';

// Posts in newest-first order. Slug = filename without .md.
// Dates space the posts roughly a week apart so ordering is stable.
const ORDER = [
  { slug: 'ai-social-media-restaurants',          date: '2026-05-20' },
  { slug: 'ai-food-waste-inventory-restaurants',  date: '2026-05-13' },
  { slug: 'ai-review-response-restaurants',       date: '2026-05-06' },
  { slug: 'restaurant-staff-ai-adoption',         date: '2026-04-29' },
  { slug: 'canadian-ai-privacy-restaurants',      date: '2026-04-22' },
];

// ── Markdown parser ───────────────────────────────────────────────────────
// Supports: # h1, ## h2, **bold**, [text](url), blank-line paragraphs.
// Anything fancier isn't used by these posts.

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function renderInline(text) {
  // Escape HTML first, then re-introduce links and bold via placeholders.
  let out = escapeHtml(text);
  // [text](url) → <a>
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
    const isExternal = /^https?:\/\//i.test(url) && !url.includes('menumindx.netlify.app');
    const attrs = isExternal
      ? ` target="_blank" rel="noopener noreferrer"`
      : '';
    return `<a href="${escapeAttr(url)}"${attrs}>${label}</a>`;
  });
  // **bold**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  return out;
}

function renderMarkdownBody(md) {
  // Split into blocks by blank lines.
  const blocks = md.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const out = [];
  for (const block of blocks) {
    if (block.startsWith('## ')) {
      out.push(`<h2>${renderInline(block.slice(3).trim())}</h2>`);
    } else if (block.startsWith('# ')) {
      // Shouldn't appear in body, but handle defensively.
      out.push(`<h2>${renderInline(block.slice(2).trim())}</h2>`);
    } else {
      // Paragraph — preserve single line breaks as <br> only if the block has them;
      // these posts don't use mid-paragraph breaks, so simple joining is fine.
      out.push(`<p>${renderInline(block.replace(/\n/g, ' '))}</p>`);
    }
  }
  return out.join('\n');
}

// ── Frontmatter parser ────────────────────────────────────────────────────
// Format: title is the first `# ...` line, then **Meta Description:** and
// **Target Keywords:** lines, then `---`, then body, then `---`, then CTA.
// We treat the markdown's trailing CTA as discarded — the rendered page
// gets a styled BlogCTA card instead.

function parsePost(md) {
  const lines = md.split(/\r?\n/);
  let title = '';
  let metaDesc = '';
  let keywords = '';
  let i = 0;

  // Title
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      i++;
      break;
    }
  }

  // Metadata lines and the first ---
  for (; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '---') {
      i++;
      break;
    }
    const md1 = line.match(/^\*\*Meta Description:\*\*\s*(.+)$/);
    if (md1) { metaDesc = md1[1].trim(); continue; }
    const kw1 = line.match(/^\*\*Target Keywords?:\*\*\s*(.+)$/);
    if (kw1) { keywords = kw1[1].trim(); continue; }
  }

  // Body until the next --- (or EOF).
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
  // Cut at the last word boundary before n.
  const cut = s.slice(0, n);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[m - 1]} ${d}, ${y}`;
}

// ── Shared CSS ────────────────────────────────────────────────────────────
// Mirrors the dark-theme variables and aesthetic of index.html /
// marketplace-calculator.html so the blog feels native.

const SHARED_CSS = `
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #242836;
    --border: #2e3345;
    --text: #e8eaed;
    --text-dim: #9aa0b0;
    --accent: #f59e0b;
    --accent-hover: #d97706;
    --red: #ef4444;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(145deg, #0f1117 0%, #111827 30%, #0f1729 60%, #0c1a2e 100%);
    background-attachment: fixed;
    color: var(--text);
    line-height: 1.6;
    min-height: 100vh;
  }

  a { color: var(--accent); }

  nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 32px;
    border-bottom: 1px solid rgba(245,158,11,0.1);
    background: rgba(15,17,23,0.85);
    backdrop-filter: blur(12px);
    position: sticky;
    top: 0;
    z-index: 50;
  }
  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    text-decoration: none;
  }
  .logo img { height: 28px; width: auto; }
  .logo .brand { color: var(--text); }
  .logo .brand span { color: var(--accent); }
  .logo .by { font-size: 11px; font-weight: 400; color: var(--text-dim); letter-spacing: 0; }
  nav .nav-links { display: flex; gap: 24px; align-items: center; }
  nav a.nav-link {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s;
  }
  nav a.nav-link:hover { color: var(--text); }

  .landing-footer { border-top: 1px solid var(--border); padding: 20px 32px; margin-top: 80px; }
  .footer-inner {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-dim);
  }
  .footer-brand { font-weight: 700; font-size: 15px; color: var(--text); }
  .footer-brand span { color: var(--accent); }

  /* CTA card — used on every post and as a banner on the listing */
  .blog-cta {
    background: linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04));
    border: 1px solid rgba(245,158,11,0.35);
    border-radius: 14px;
    padding: 32px;
    text-align: center;
    margin: 48px 0;
  }
  .blog-cta h3 {
    font-size: clamp(20px, 3vw, 24px);
    font-weight: 700;
    color: var(--text);
    margin-bottom: 18px;
    line-height: 1.3;
  }
  .blog-cta .cta-btn {
    display: inline-block;
    background: linear-gradient(110deg, #f59e0b 0%, #ef4444 100%);
    color: #fff;
    font-weight: 700;
    font-size: 15px;
    padding: 14px 32px;
    border-radius: 10px;
    border: 2px solid var(--accent);
    text-decoration: none;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 0 18px rgba(245,158,11,0.4);
  }
  .blog-cta .cta-btn:hover {
    transform: translateY(-2px);
    box-shadow: 0 0 28px rgba(245,158,11,0.6);
  }
  .blog-cta .cta-secondary {
    display: block;
    margin-top: 16px;
    font-size: 14px;
    color: var(--text-dim);
    text-decoration: none;
  }
  .blog-cta .cta-secondary:hover { color: var(--accent); }
`;

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

  .blog-grid-wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 24px 80px;
  }
  .blog-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
  }
  @media (min-width: 640px) {
    .blog-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 960px) {
    .blog-grid { grid-template-columns: 1fr 1fr 1fr; }
  }

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
  .post-card .read-more {
    color: var(--accent);
    font-weight: 600;
    font-size: 14px;
  }

  @media (max-width: 640px) {
    nav { padding: 12px 16px; }
    .blog-hero { padding: 48px 16px 32px; }
    .blog-grid-wrap { padding: 0 16px 60px; }
    .blog-cta { padding: 24px; margin: 32px 0; }
  }
`;

const POST_CSS = `
  .post-wrap {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 24px 80px;
  }
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

  .post-content {
    font-size: 17px;
    line-height: 1.75;
    color: #d8dae0;
  }
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
  .post-nav .title {
    font-size: 14px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.4;
  }
  .post-nav .next { text-align: right; }
  .post-nav .empty { background: transparent; border: none; pointer-events: none; }

  @media (max-width: 640px) {
    nav { padding: 12px 16px; }
    .post-wrap { padding: 24px 16px 60px; }
    .post-content { font-size: 16px; }
    .post-nav { grid-template-columns: 1fr; }
    .post-nav .next { text-align: left; }
  }
`;

// ── Shared layout fragments ───────────────────────────────────────────────

function navHtml() {
  return `
<nav>
  <a href="/" class="logo">
    <span class="brand">Menu<span>Mind</span></span>
    <span class="by">by</span>
    <img src="/menulogo.JPG" alt="menu.ca">
  </a>
  <div class="nav-links">
    <a href="/marketplace-calculator.html" class="nav-link">Marketplace Calculator</a>
    <a href="/blog/" class="nav-link">Blog</a>
    <a href="/" class="nav-link">Start Over</a>
  </div>
</nav>`;
}

function footerHtml() {
  return `
<footer class="landing-footer">
  <div class="footer-inner">
    <span class="footer-brand">Menu<span>Mind</span></span>
    <span>by menu.ca</span>
  </div>
</footer>`;
}

function ctaHtml() {
  return `
<aside class="blog-cta">
  <h3>Ready to see what AI can do for your restaurant?</h3>
  <a href="https://worklocal.ca/demo" target="_blank" rel="noopener noreferrer" class="cta-btn">Book Your Free Demo</a>
  <a href="/" class="cta-secondary">Or try our free Menu Audit →</a>
</aside>`;
}

// ── Page templates ────────────────────────────────────────────────────────

function postPage(post, prev, next) {
  const title = `${post.title} — MenuMind`;
  const url = `${SITE_URL}/blog/${post.slug}.html`;
  return `<!DOCTYPE html>
<html lang="en">
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

<style>${SHARED_CSS}${POST_CSS}</style>
</head>
<body>
${navHtml()}

<main class="post-wrap">
  <a href="/blog/" class="back-link">← Back to Blog</a>

  <header class="post-header">
    <h1>${escapeHtml(post.title)}</h1>
    <div class="post-meta">
      <span>${fmtDate(post.date)}</span>
      <span class="dot">·</span>
      <span>${post.readMin} min read</span>
    </div>
  </header>

  <article class="post-content">
${post.bodyHtml}
  </article>

  ${ctaHtml()}

  <nav class="post-nav">
    ${prev
      ? `<a href="/blog/${prev.slug}.html" class="prev"><div class="label">← Previous</div><div class="title">${escapeHtml(prev.title)}</div></a>`
      : `<div class="empty"></div>`}
    ${next
      ? `<a href="/blog/${next.slug}.html" class="next"><div class="label">Next →</div><div class="title">${escapeHtml(next.title)}</div></a>`
      : `<div class="empty"></div>`}
  </nav>
</main>

${footerHtml()}
</body>
</html>
`;
}

function listingPage(posts) {
  const title = 'Restaurant AI Insights — MenuMind Blog';
  const desc = 'AI insights and practical guides for independent restaurant owners. Menu engineering, marketplace economics, food waste, staff adoption, privacy law, and more.';
  const url = `${SITE_URL}/blog/`;

  const cards = posts.map(p => `
    <a href="/blog/${p.slug}.html" class="post-card">
      <div class="meta">${fmtDate(p.date)} · ${p.readMin} min read</div>
      <h2>${escapeHtml(p.title)}</h2>
      <p>${escapeHtml(excerpt(p.metaDesc, 120))}</p>
      <div class="read-more">Read More →</div>
    </a>`).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
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

<style>${SHARED_CSS}${LISTING_CSS}</style>
</head>
<body>
${navHtml()}

<section class="blog-hero">
  <div class="hero-badge">MenuMind Blog</div>
  <h1>Restaurant <span>AI Insights</span></h1>
  <p>Practical guides for independent restaurant owners — menu engineering, marketplace economics, AI adoption, and the real-world plays that move margin.</p>
</section>

<div class="blog-grid-wrap">
  <div class="blog-grid">
${cards}
  </div>

  ${ctaHtml()}
</div>

${footerHtml()}
</body>
</html>
`;
}

function homepageTeaser(posts) {
  // Snippet inlined into index.html between the existing sections.
  const top3 = posts.slice(0, 3);
  const cards = top3.map(p => `
      <a href="/blog/${p.slug}.html" class="blog-teaser-card">
        <div class="blog-teaser-meta">${fmtDate(p.date)} · ${p.readMin} min read</div>
        <h3>${escapeHtml(p.title)}</h3>
        <p>${escapeHtml(excerpt(p.metaDesc, 120))}</p>
        <span class="blog-teaser-link">Read More →</span>
      </a>`).join('');
  return `
  <!-- ── FROM OUR BLOG ── -->
  <section class="blog-teaser-section">
    <h2>From Our Blog</h2>
    <p class="blog-teaser-sub">AI insights and practical guides for independent restaurant owners.</p>
    <div class="blog-teaser-grid">${cards}
    </div>
    <div class="blog-teaser-cta">
      <a href="/blog/" class="blog-teaser-viewall">View All Posts →</a>
    </div>
  </section>
`;
}

// ── Main ──────────────────────────────────────────────────────────────────

function main() {
  const posts = ORDER.map(({ slug, date }) => {
    const file = path.join(POSTS_DIR, `${slug}.md`);
    if (!fs.existsSync(file)) {
      throw new Error(`Missing post file: ${file}`);
    }
    const md = fs.readFileSync(file, 'utf8');
    const parsed = parsePost(md);
    return {
      slug,
      date,
      title: parsed.title,
      metaDesc: parsed.metaDesc,
      keywords: parsed.keywords,
      body: parsed.body,
      bodyHtml: renderMarkdownBody(parsed.body),
      readMin: readTime(parsed.body),
    };
  });

  // Write listing.
  fs.writeFileSync(path.join(BLOG_DIR, 'index.html'), listingPage(posts), 'utf8');
  console.log('Wrote blog/index.html');

  // Write per-post pages.
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    // newest first; "previous post" chronologically = older = next in array.
    const olderPost = posts[i + 1] || null;
    const newerPost = posts[i - 1] || null;
    // Use "previous" = older, "next" = newer (matches typical blog UX).
    const html = postPage(post, olderPost, newerPost);
    fs.writeFileSync(path.join(BLOG_DIR, `${post.slug}.html`), html, 'utf8');
    console.log(`Wrote blog/${post.slug}.html`);
  }

  // Write homepage teaser snippet.
  fs.writeFileSync(path.join(BLOG_DIR, '_homepage-teaser.html'), homepageTeaser(posts), 'utf8');
  console.log('Wrote blog/_homepage-teaser.html');

  console.log(`\nGenerated ${posts.length} posts.`);
}

main();
