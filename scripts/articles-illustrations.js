// Illustrations SVG par article de blog, copiées telles quelles depuis la
// const ARTICLE_ILLUSTRATIONS d'index.html (rendu #/blog dans l'app) pour
// que les pages statiques /blog/*.html affichent le même visuel coloré.
// Si un article change dans index.html, reporter ici puis relancer
// `node scripts/generate-blog-pages.js`.
module.exports = {
  'bankroll-management-regles-essentielles': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="150" cy="32" r="46" fill="var(--green)" opacity="0.08"/>
    <line x1="18" y1="46" x2="176" y2="46" stroke="var(--green)" stroke-width="2" stroke-dasharray="5 5" opacity="0.5"/>
    <rect x="28" y="70" width="18" height="30" rx="3" fill="var(--green)" opacity="0.35"/>
    <rect x="56" y="56" width="18" height="44" rx="3" fill="var(--green)" opacity="0.55"/>
    <rect x="84" y="38" width="18" height="62" rx="3" fill="var(--green)" opacity="0.75"/>
    <rect x="112" y="20" width="18" height="80" rx="3" fill="var(--green)"/>
    <path d="M152 12l7 3.5v10.5c0 8-4 12.5-7 14.5-3-2-7-6.5-7-14.5V15.5Z" fill="none" stroke="var(--green)" stroke-width="2.2" stroke-linejoin="round"/>
    <path d="M148.5 23l2.6 2.6 4.6-5" stroke="var(--green)" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`,
  'combien-de-buyins-mtt': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="55" cy="38" r="42" fill="var(--amber)" opacity="0.08"/>
    <g stroke="var(--amber)" stroke-width="2.2" fill="none">
      <ellipse cx="34" cy="94" rx="16" ry="6"/>
      <ellipse cx="34" cy="85" rx="16" ry="6"/>
      <ellipse cx="34" cy="76" rx="16" ry="6"/>
      <ellipse cx="34" cy="67" rx="16" ry="6"/>
    </g>
    <g stroke="var(--amber)" stroke-width="2.2" fill="none" opacity="0.6">
      <ellipse cx="70" cy="97" rx="13" ry="5"/>
      <ellipse cx="70" cy="90" rx="13" ry="5"/>
      <ellipse cx="70" cy="83" rx="13" ry="5"/>
    </g>
    <path d="M128 18h32v11c0 10.5-7.2 18-16 18s-16-7.5-16-18Z" fill="none" stroke="var(--amber)" stroke-width="2.4"/>
    <path d="M128 22h-8a8 8 0 0 0 8 13.5M160 22h8a8 8 0 0 1-8 13.5" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M144 47v9M136 62h16l-2-6h-12Z" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linejoin="round"/>
  </svg>`,
  'cashgame-vs-tournoi-gestion-bankroll': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="46" r="46" fill="var(--violet)" opacity="0.07"/>
    <line x1="100" y1="22" x2="100" y2="60" stroke="var(--violet)" stroke-width="2.4"/>
    <path d="M60 34h80" stroke="var(--violet)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="100" cy="30" r="4" fill="var(--violet)"/>
    <line x1="60" y1="34" x2="44" y2="64" stroke="var(--violet)" stroke-width="2" opacity="0.7"/>
    <line x1="60" y1="34" x2="76" y2="64" stroke="var(--violet)" stroke-width="2" opacity="0.7"/>
    <path d="M44 64a16 9 0 0 0 32 0Z" fill="none" stroke="var(--violet)" stroke-width="2.2"/>
    <ellipse cx="60" cy="60" rx="9" ry="3.6" fill="var(--violet)" opacity="0.6"/>
    <line x1="140" y1="34" x2="124" y2="64" stroke="var(--violet)" stroke-width="2" opacity="0.7"/>
    <line x1="140" y1="34" x2="156" y2="64" stroke="var(--violet)" stroke-width="2" opacity="0.7"/>
    <path d="M124 64a16 9 0 0 0 32 0Z" fill="none" stroke="var(--violet)" stroke-width="2.2"/>
    <rect x="132" y="50" width="15" height="11" rx="1.5" fill="var(--violet)" opacity="0.6" transform="rotate(-10 139 55)"/>
    <rect x="94" y="86" width="12" height="16" rx="1.5" fill="var(--violet)" opacity="0.45"/>
  </svg>`,
  'expresso-spin-go-variance': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="72" cy="58" r="46" fill="var(--critical)" opacity="0.08"/>
    <path d="M102 14 70 64h20l-9 44 47-60h-24Z" fill="var(--critical)"/>
    <g stroke="var(--critical)" stroke-width="2.2" fill="none" opacity="0.85">
      <rect x="138" y="28" width="27" height="27" rx="6" transform="rotate(18 151.5 41.5)"/>
    </g>
    <circle cx="147" cy="38" r="2.1" fill="var(--critical)"/>
    <circle cx="156" cy="46" r="2.1" fill="var(--critical)"/>
    <path d="M148 80a15 15 0 1 1 9.5 14" stroke="var(--critical)" stroke-width="2.2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M161 90l-4.5 7.5-7.5-3.2" stroke="var(--critical)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.7"/>
  </svg>`,
  'live-vs-online-adapter-bankroll': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="52" r="48" fill="var(--blue)" opacity="0.07"/>
    <ellipse cx="44" cy="82" rx="36" ry="15" fill="none" stroke="var(--blue)" stroke-width="2.2"/>
    <rect x="30" y="58" width="14" height="20" rx="2" fill="var(--blue)" opacity="0.55" transform="rotate(-10 37 68)"/>
    <rect x="44" y="56" width="14" height="20" rx="2" fill="var(--blue)" opacity="0.8" transform="rotate(8 51 66)"/>
    <line x1="98" y1="18" x2="98" y2="102" stroke="var(--blue)" stroke-width="1.5" stroke-dasharray="3 5" opacity="0.35"/>
    <rect x="118" y="28" width="58" height="38" rx="4" fill="none" stroke="var(--blue)" stroke-width="2.2"/>
    <path d="M126 56l10-10 8 6 12-14" stroke="var(--blue)" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <rect x="140" y="66" width="14" height="5" fill="var(--blue)" opacity="0.5"/>
    <rect x="134" y="72" width="26" height="4" rx="2" fill="var(--blue)" opacity="0.35"/>
  </svg>`,
  'suivre-statistiques-poker-pourquoi-comment': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="70" cy="62" r="46" fill="var(--green)" opacity="0.07"/>
    <path d="M20 92 45 67 62 80 90 42 115 60" fill="none" stroke="var(--green)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.8"/>
    <circle cx="45" cy="67" r="3" fill="var(--green)"/>
    <circle cx="62" cy="80" r="3" fill="var(--green)"/>
    <circle cx="90" cy="42" r="3" fill="var(--green)"/>
    <circle cx="115" cy="60" r="3" fill="var(--green)"/>
    <circle cx="145" cy="55" r="22" fill="none" stroke="var(--green)" stroke-width="3"/>
    <line x1="161" y1="71" x2="177" y2="87" stroke="var(--green)" stroke-width="4" stroke-linecap="round"/>
    <rect x="135" y="48" width="20" height="2" fill="var(--green)" opacity="0.5"/>
  </svg>`,
  'calendrier-tournois-live-2026-preparer-bankroll': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="140" cy="40" r="44" fill="var(--amber)" opacity="0.07"/>
    <rect x="20" y="24" width="90" height="76" rx="6" fill="none" stroke="var(--amber)" stroke-width="2.2"/>
    <path d="M20 44h90" stroke="var(--amber)" stroke-width="2.2"/>
    <path d="M40 16v16M90 16v16" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round"/>
    <rect x="34" y="54" width="12" height="12" rx="2" fill="var(--amber)" opacity="0.5"/>
    <rect x="54" y="54" width="12" height="12" rx="2" fill="var(--amber)" opacity="0.85"/>
    <rect x="74" y="54" width="12" height="12" rx="2" fill="var(--amber)" opacity="0.3"/>
    <rect x="34" y="74" width="12" height="12" rx="2" fill="var(--amber)" opacity="0.3"/>
    <rect x="54" y="74" width="12" height="12" rx="2" fill="var(--amber)" opacity="0.5"/>
    <path d="M150 20c-13 0-22 10-22 22 0 16 22 40 22 40s22-24 22-40c0-12-9-22-22-22Z" fill="none" stroke="var(--amber)" stroke-width="2.4"/>
    <circle cx="150" cy="42" r="7" fill="var(--amber)"/>
  </svg>`,
  'tendances-poker-en-ligne-2026': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="100" cy="55" r="48" fill="var(--blue)" opacity="0.07"/>
    <rect x="34" y="30" width="90" height="58" rx="4" fill="none" stroke="var(--blue)" stroke-width="2.2"/>
    <path d="M46 72 66 54 82 64 108 40" fill="none" stroke="var(--blue)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="66" cy="54" r="3" fill="var(--blue)"/>
    <circle cx="82" cy="64" r="3" fill="var(--blue)"/>
    <circle cx="108" cy="40" r="3" fill="var(--blue)"/>
    <path d="M20 96h140" stroke="var(--blue)" stroke-width="2.2" stroke-linecap="round" opacity="0.5"/>
    <circle cx="150" cy="34" r="5" fill="none" stroke="var(--blue)" stroke-width="2"/>
    <circle cx="164" cy="52" r="5" fill="none" stroke="var(--blue)" stroke-width="2"/>
    <circle cx="150" cy="70" r="5" fill="none" stroke="var(--blue)" stroke-width="2"/>
    <path d="M150 34l14 18M164 52l-14 18" stroke="var(--blue)" stroke-width="1.6" opacity="0.6"/>
  </svg>`,
  'fiscalite-gains-poker-france': `<svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
    <circle cx="70" cy="55" r="46" fill="var(--violet)" opacity="0.07"/>
    <rect x="30" y="18" width="70" height="90" rx="5" fill="none" stroke="var(--violet)" stroke-width="2.2"/>
    <path d="M42 38h46M42 52h46M42 66h30" stroke="var(--violet)" stroke-width="2.2" stroke-linecap="round"/>
    <circle cx="140" cy="70" r="26" fill="none" stroke="var(--violet)" stroke-width="2.4"/>
    <circle cx="131" cy="61" r="4" fill="var(--violet)"/>
    <circle cx="149" cy="79" r="4" fill="var(--violet)"/>
    <line x1="128" y1="82" x2="152" y2="58" stroke="var(--violet)" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`,
};
