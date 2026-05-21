// Shared chrome (nav, footer, CTA) and design tokens used by every generated
// page. Keep this file as the single source of truth — when nav or footer
// changes, update it here and re-run the build script.

const SITE_URL = 'https://menumindx.netlify.app';
const WORK_LOCAL_DEMO = 'https://worklocal.ca/demo';

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

const FAVICON_HREF = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='6' fill='%23dc2626'/%3E%3Ctext x='16' y='23' text-anchor='middle' font-family='Arial,sans-serif' font-weight='800' font-size='20' fill='white'%3EM%3C/text%3E%3C/svg%3E";

// Shared dark-theme variables and base body styles used by every generated page.
const BASE_CSS = `
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
    --green: #22c55e;
    --green-bg: rgba(34,197,94,0.12);
    --red: #ef4444;
    --red-bg: rgba(239,68,68,0.12);
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

  nav.site-nav {
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
  nav.site-nav .logo {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 22px;
    font-weight: 800;
    letter-spacing: -0.5px;
    text-decoration: none;
  }
  nav.site-nav .logo img { height: 28px; width: auto; }
  nav.site-nav .logo .brand { color: var(--text); }
  nav.site-nav .logo .brand span { color: var(--accent); }
  nav.site-nav .logo .by { font-size: 11px; font-weight: 400; color: var(--text-dim); letter-spacing: 0; }
  nav.site-nav .nav-links { display: flex; gap: 24px; align-items: center; }
  nav.site-nav a.nav-link {
    color: var(--text-dim);
    text-decoration: none;
    font-size: 14px;
    font-weight: 500;
    transition: color 0.2s;
  }
  nav.site-nav a.nav-link:hover { color: var(--text); }
  nav.site-nav .lang-switch {
    color: var(--text-dim);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.5px;
    padding-left: 8px;
    border-left: 1px solid var(--border);
  }
  nav.site-nav .lang-switch a {
    color: var(--text-dim);
    text-decoration: none;
    transition: color 0.2s;
  }
  nav.site-nav .lang-switch a.active { color: var(--accent); }
  nav.site-nav .lang-switch a:hover { color: var(--text); }
  nav.site-nav .lang-switch span { opacity: 0.4; padding: 0 4px; }

  footer.site-footer { border-top: 1px solid var(--border); padding: 20px 32px; margin-top: 80px; }
  footer.site-footer .footer-inner {
    max-width: 1000px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text-dim);
  }
  footer.site-footer .footer-brand { font-weight: 700; font-size: 15px; color: var(--text); }
  footer.site-footer .footer-brand span { color: var(--accent); }

  /* Reusable CTA card — same shape on every page that wants one */
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

// Localized link labels — both languages defined in one place.
const LABELS = {
  en: {
    htmlLang: 'en',
    menuAudit: 'Menu Audit',
    marketplaceCalc: 'Marketplace Calculator',
    blog: 'Blog',
    backToBlog: '← Back to Blog',
    readMore: 'Read More →',
    minRead: 'min read',
    ctaTitle: 'Ready to see what AI can do for your restaurant?',
    ctaBtn: 'Book Your Free Demo',
    ctaSecondary: 'Or try our free Menu Audit →',
    poweredBy: 'by menu.ca',
  },
  fr: {
    htmlLang: 'fr',
    menuAudit: 'Audit du menu',
    marketplaceCalc: 'Calculateur de plateformes',
    blog: 'Blogue',
    backToBlog: '← Retour au blogue',
    readMore: 'Lire la suite →',
    minRead: 'min de lecture',
    ctaTitle: 'Prêt à voir ce que l\'IA peut faire pour votre restaurant?',
    ctaBtn: 'Réservez votre démo gratuite',
    ctaSecondary: 'Ou essayez notre audit gratuit →',
    poweredBy: 'par menu.ca',
  },
};

// Builds the site nav for a given page.
//   opts.lang        — 'en' | 'fr'
//   opts.current     — 'home' | 'calc' | 'blog' (highlight which link is active)
//   opts.englishUrl  — URL of the English equivalent of the current page (for the EN switch)
//   opts.frenchUrl   — URL of the French equivalent of the current page (for the FR switch)
function navHtml(opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en';
  const L = LABELS[lang];
  const isFr = lang === 'fr';
  const homeHref = isFr ? '/fr/' : '/';
  const calcHref = isFr ? '/fr/marketplace-calculator.html' : '/marketplace-calculator.html';
  const blogHref = isFr ? '/fr/blog/' : '/blog/';
  const englishUrl = opts.englishUrl || '/';
  const frenchUrl = opts.frenchUrl || '/fr/';

  return `
<nav class="site-nav">
  <a href="${homeHref}" class="logo">
    <span class="brand">Menu<span>Mind</span></span>
    <span class="by">${isFr ? 'par' : 'by'}</span>
    <img src="/menulogo.JPG" alt="menu.ca">
  </a>
  <div class="nav-links">
    <a href="${homeHref}" class="nav-link">${L.menuAudit}</a>
    <a href="${calcHref}" class="nav-link">${L.marketplaceCalc}</a>
    <a href="${blogHref}" class="nav-link">${L.blog}</a>
    <span class="lang-switch">
      <a href="${englishUrl}" class="${lang === 'en' ? 'active' : ''}">EN</a>
      <span>|</span>
      <a href="${frenchUrl}" class="${lang === 'fr' ? 'active' : ''}">FR</a>
    </span>
  </div>
</nav>`;
}

function footerHtml(opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en';
  const L = LABELS[lang];
  return `
<footer class="site-footer">
  <div class="footer-inner">
    <span class="footer-brand">Menu<span>Mind</span></span>
    <span>${L.poweredBy}</span>
  </div>
</footer>`;
}

function ctaHtml(opts = {}) {
  const lang = opts.lang === 'fr' ? 'fr' : 'en';
  const L = LABELS[lang];
  const auditHref = lang === 'fr' ? '/fr/' : '/';
  return `
<aside class="blog-cta">
  <h3>${L.ctaTitle}</h3>
  <a href="${WORK_LOCAL_DEMO}" target="_blank" rel="noopener noreferrer" class="cta-btn">${L.ctaBtn}</a>
  <a href="${auditHref}" class="cta-secondary">${L.ctaSecondary}</a>
</aside>`;
}

// Wraps page-specific body content in the standard chrome. Useful for new pages
// (city pages, future tool pages) so they don't reinvent nav/footer.
function pageShell({ title, description, lang, englishUrl, frenchUrl, extraHead = '', extraCss = '', body }) {
  const L = LABELS[lang === 'fr' ? 'fr' : 'en'];
  const ogType = 'website';
  return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
<meta name="description" content="${escapeAttr(description)}">
<link rel="icon" type="image/svg+xml" href="${FAVICON_HREF}">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${escapeAttr(title)}">
<meta property="og:description" content="${escapeAttr(description)}">
${englishUrl ? `<link rel="alternate" hreflang="en-CA" href="${SITE_URL}${englishUrl}">` : ''}
${frenchUrl ? `<link rel="alternate" hreflang="fr-CA" href="${SITE_URL}${frenchUrl}">` : ''}
${extraHead}
<style>${BASE_CSS}${extraCss}</style>
</head>
<body>
${navHtml({ lang, englishUrl, frenchUrl })}

${body}

${footerHtml({ lang })}
</body>
</html>
`;
}

module.exports = {
  SITE_URL,
  WORK_LOCAL_DEMO,
  FAVICON_HREF,
  BASE_CSS,
  LABELS,
  escapeHtml,
  escapeAttr,
  navHtml,
  footerHtml,
  ctaHtml,
  pageShell,
};
