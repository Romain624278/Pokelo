// Génère blog.html (listing) + blog/<slug>.html (un par article) à partir de
// scripts/articles-data.js — pages statiques réelles, indexables séparément
// de l'app (#/blog reste disponible dans l'app pour l'usage interne/lecture
// pendant qu'on est connecté, mais Google ne peut pas indexer un fragment
// #hash comme une page à part : voir l'audit SEO qui a motivé ce chantier).
// Usage : node scripts/generate-blog-pages.js
const fs = require('fs');
const path = require('path');
const ARTICLES = require('./articles-data');
const ILLUSTRATIONS = require('./articles-illustrations');

const ROOT = path.join(__dirname, '..');
const SITE = 'https://www.pokelo.fr';
const ACCENT_VAR = { green: '--green', amber: '--amber', violet: '--violet', critical: '--critical', blue: '--blue' };

function escapeAttr(s){ return String(s).replace(/"/g, '&quot;'); }
function plainExcerpt(s){ return s.replace(/\s+/g, ' ').trim(); }

function headBlock({ title, description, canonicalPath, jsonLd, ogType }){
  const rel = canonicalPath.split('/').length > 2 ? '../' : '';
  return `<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${escapeAttr(description)}" />
<meta name="robots" content="index, follow" />
<meta name="author" content="Pokelo" />
<link rel="canonical" href="${SITE}${canonicalPath}" />
<meta property="og:type" content="${ogType || 'website'}" />
<meta property="og:site_name" content="Pokelo" />
<meta property="og:locale" content="fr_FR" />
<meta property="og:url" content="${SITE}${canonicalPath}" />
<meta property="og:title" content="${escapeAttr(title)}" />
<meta property="og:description" content="${escapeAttr(description)}" />
<meta property="og:image" content="${SITE}/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${escapeAttr(title)}" />
<meta name="twitter:description" content="${escapeAttr(description)}" />
<meta name="twitter:image" content="${SITE}/og-image.png" />
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
<link rel="icon" type="image/png" sizes="192x192" href="${rel}icons/icon-192.png" />
<link rel="icon" type="image/png" sizes="512x512" href="${rel}icons/icon-512.png" />
<link rel="shortcut icon" type="image/png" href="${rel}icons/icon-192.png" />
<link rel="manifest" href="${rel}manifest.json" />
<meta name="theme-color" content="#08BF2F" />
<link rel="apple-touch-icon" href="${rel}icons/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&family=Bebas+Neue&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="${rel}assets/site-marketing.css" />`;
}

function navBlock(activePath){
  return `<nav class="site-nav">
  <a class="nav-logo" href="/">
    <svg class="logo-mark" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" width="32" height="32">
      <rect class="lb1" x="4" y="32" width="7" height="10" rx="2"/><rect class="lb2" x="15" y="25" width="7" height="17" rx="2"/><rect class="lb3" x="26" y="18" width="7" height="24" rx="2"/>
      <path class="lpip" d="M29.5 4C23 10 20 14 20 17.5C20 20 22.2 22 25 22C26.8 22 28.4 21.2 29.5 19.8C30.6 21.2 32.2 22 34 22C36.8 22 39 20 39 17.5C39 14 36 10 29.5 4Z"/>
    </svg>
    <span>Pokelo</span>
  </a>
  <ul class="nav-links">
    <li><a href="/fonctionnalites"${activePath==='/fonctionnalites'?' class="active"':''}>Fonctionnalités</a></li>
    <li><a href="/#pricing">Tarifs</a></li>
    <li><a href="/blog"${activePath==='/blog'?' class="active"':''}>Blog</a></li>
    <li><a href="/calendrier"${activePath==='/calendrier'?' class="active"':''}>Calendrier</a></li>
    <li><a href="/#/account" class="nav-cta">Se connecter</a></li>
  </ul>
  <button class="nav-burger" id="burger" aria-label="Menu" onclick="document.getElementById('burger').classList.toggle('open');document.getElementById('mobileMenu').classList.toggle('open');">
    <span></span><span></span><span></span>
  </button>
</nav>

<div class="mobile-menu" id="mobileMenu">
  <a href="/fonctionnalites">Fonctionnalités</a>
  <a href="/#pricing">Tarifs</a>
  <a href="/blog">Blog</a>
  <a href="/calendrier">Calendrier</a>
  <a href="/#/account" class="nav-cta">Se connecter</a>
</div>`;
}

function footerBlock(){
  return `<footer class="site-footer">
  <div class="footer-top">
    <div class="footer-brand">
      <svg class="logo-mark" viewBox="0 0 48 48" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
        <rect class="lb1" x="4" y="32" width="7" height="10" rx="2"/><rect class="lb2" x="15" y="25" width="7" height="17" rx="2"/><rect class="lb3" x="26" y="18" width="7" height="24" rx="2"/>
        <path class="lpip" d="M29.5 4C23 10 20 14 20 17.5C20 20 22.2 22 25 22C26.8 22 28.4 21.2 29.5 19.8C30.6 21.2 32.2 22 34 22C36.8 22 39 20 39 17.5C39 14 36 10 29.5 4Z"/>
      </svg>
      <span>Pokelo</span>
    </div>
  </div>
  <div class="footer-bottom">
    <span>© 2026 Pokelo. Tous droits réservés.</span>
    <span>Le poker responsable commence par une bonne gestion de bankroll.</span>
  </div>
</footer>`;
}

function fmtDateFr(iso){
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Génère chaque page article ──
for (const a of ARTICLES) {
  const canonicalPath = `/blog/${a.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: plainExcerpt(a.excerpt),
    datePublished: a.date,
    author: { '@type': 'Organization', name: 'Pokelo' },
    publisher: { '@type': 'Organization', name: 'Pokelo', url: SITE + '/' },
    mainEntityOfPage: SITE + canonicalPath,
  };
  const accentVar = ACCENT_VAR[a.accent] || '--green';
  const illu = ILLUSTRATIONS[a.slug] || '';
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
${headBlock({ title: `${a.title} | Pokelo`, description: plainExcerpt(a.excerpt), canonicalPath, jsonLd, ogType: 'article' })}
</head>
<body>
${navBlock('/blog')}

<main>
  <section id="article-view">
    <div class="article-wrap">
      <a href="/blog" class="article-back">&larr; Retour au blog</a>
      <div class="article-banner" style="background: radial-gradient(circle at 75% 20%, color-mix(in srgb, var(${accentVar}) 18%, transparent) 0%, var(--black-card) 70%);">
        <div class="article-banner-icon">${illu}</div>
      </div>
      <span class="article-tag">${a.tag}</span>
      <h1 class="article-title">${a.title}</h1>
      <div class="article-meta">${fmtDateFr(a.date)} · ${a.readTime} de lecture</div>
      <div class="article-body">${a.content}</div>
      <div class="article-cta">
        <p>Mettez ces principes en pratique dès votre prochaine session.</p>
        <a href="/#/account/signup" class="btn-primary">Créer un compte gratuit</a>
      </div>
    </div>
  </section>
</main>

${footerBlock()}
</body>
</html>
`;
  fs.writeFileSync(path.join(ROOT, 'blog', `${a.slug}.html`), html, 'utf8');
}

// ── Génère la page de listing /blog ──
const listingJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Blog',
  name: 'Blog Pokelo',
  url: SITE + '/blog',
  blogPost: ARTICLES.map(a => ({
    '@type': 'BlogPosting',
    headline: a.title,
    datePublished: a.date,
    url: `${SITE}/blog/${a.slug}`,
  })),
};
const cardsHtml = ARTICLES.map(a => {
  const accentVar = ACCENT_VAR[a.accent] || '--green';
  const illu = ILLUSTRATIONS[a.slug] || '';
  return `      <a class="blog-card" href="/blog/${a.slug}" data-type="${a.type}">
        <div class="blog-card-top" style="background: radial-gradient(circle at 75% 15%, color-mix(in srgb, var(${accentVar}) 16%, transparent) 0%, var(--black) 70%);">
          <div class="blog-card-icon">${illu}</div>
          <span class="tag" style="color: var(${accentVar}); background: color-mix(in srgb, var(${accentVar}) 14%, transparent);">${a.tag}</span>
        </div>
        <div class="blog-card-body">
          <h3>${a.title}</h3>
          <p>${a.excerpt}</p>
          <div class="blog-card-meta"><span>${fmtDateFr(a.date)}</span><span class="dot"></span><span>${a.readTime}</span></div>
        </div>
      </a>`;
}).join('\n');

const blogListingHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
${headBlock({
  title: 'Blog Pokelo — Bankroll management & stratégie poker',
  description: "Guides pratiques de gestion de bankroll (cash game, MTT, expresso, live/online) et actualités poker : calendrier des tournois, tendances, fiscalité.",
  canonicalPath: '/blog',
  jsonLd: listingJsonLd,
})}
</head>
<body>
${navBlock('/blog')}

<main>
  <section id="blog-hero">
    <div class="hero-block">
      <div class="section-tag">Blog Pokelo</div>
      <h1 class="section-title">Bankroll management<br>&amp; stratégie poker</h1>
      <div class="divider"></div>
      <p class="section-sub">Des tutos courts, sans blabla, pour mieux gérer votre argent de jeu.</p>
      <div class="blog-filters">
        <a href="#" class="blog-filter active" data-filter="all" onclick="filterBlog(event,'all')">Tous</a>
        <a href="#" class="blog-filter" data-filter="guide" onclick="filterBlog(event,'guide')">Progresser</a>
        <a href="#" class="blog-filter" data-filter="news" onclick="filterBlog(event,'news')">Actualités</a>
      </div>
    </div>
    <div class="blog-grid" id="blog-grid">
${cardsHtml}
    </div>
  </section>

  <section id="cta">
    <div class="hero-block">
      <h2 class="section-title" style="font-size:clamp(1.8rem,4vw,2.6rem)">Passez de la théorie à la pratique</h2>
      <p class="section-sub">Pokelo enregistre vos sessions et transforme tout ça en graphiques clairs. Gratuit pour commencer.</p>
      <div style="margin-top:2rem">
        <a href="/#/account/signup" class="btn-primary">Créer un compte gratuit</a>
      </div>
    </div>
  </section>
</main>

${footerBlock()}

<script>
  function filterBlog(e, type){
    e.preventDefault();
    document.querySelectorAll('.blog-filter').forEach(function(b){ b.classList.remove('active'); });
    e.currentTarget.classList.add('active');
    document.querySelectorAll('#blog-grid .blog-card').forEach(function(card){
      card.hidden = type !== 'all' && card.getAttribute('data-type') !== type;
    });
  }
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(ROOT, 'blog.html'), blogListingHtml, 'utf8');

console.log(`Généré : blog.html + ${ARTICLES.length} pages dans blog/`);
