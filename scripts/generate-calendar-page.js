// Régénère la page statique calendrier.html (liste des événements, JSON-LD et
// options de filtres) à partir de la source de vérité : POKER_CALENDAR_2026,
// FLAG_SVG et COUNTRY_NAMES dans index.html. Usage : node scripts/generate-calendar-page.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const indexSrc = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pagePath = path.join(root, 'calendrier.html');
let page = fs.readFileSync(pagePath, 'utf8');

function extract(startMarker, endMarker){
  const a = indexSrc.indexOf(startMarker);
  if (a < 0) throw new Error('introuvable dans index.html : ' + startMarker);
  const b = indexSrc.indexOf(endMarker, a);
  if (b < 0) throw new Error('fin introuvable pour : ' + startMarker);
  return indexSrc.slice(a, b + endMarker.length);
}
const flagsCode = extract('const FLAG_SVG = {', '\n};') + '\nthis.out = FLAG_SVG;';
const flagsCtx = {};
vm.runInNewContext(flagsCode, flagsCtx);
const { POKER_CALENDAR_2026: events, COUNTRY_NAMES } = require('./calendar-data');
const flags = flagsCtx.out;
const names = COUNTRY_NAMES.fr;

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const d = iso => fmt.format(new Date(iso + 'T12:00:00'));
const today = new Date().toISOString().slice(0, 10);
const sorted = events.slice().sort((x, y) => x.start.localeCompare(y.start));
const CROWN = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 18h14l1.4-8.4-4.4 2.6-3-5.2-3 5.2-4.4-2.6L5 18Z"/></svg>';

function resultHtml(r){
  if (!r) return '';
  const parts = [];
  if (r.prizePool) parts.push('Prize pool ' + r.prizePool);
  if (r.payout) parts.push('Gain vainqueur ' + r.payout);
  const handle = r.handle ? ` <span class="ce-result-handle">(${esc(r.handle)})</span>` : '';
  return `
          <div class="ce-result">${CROWN}<span class="ce-result-winner">${esc(r.winner)}${handle}</span>${parts.length ? `<span class="ce-result-prize">${esc(parts.join(' · '))}</span>` : ''}${r.source ? `<span class="ce-result-source">Source : ${esc(r.source)}</span>` : ''}</div>`;
}
const listHtml = sorted.map(e => {
  const country = names[e.country] || e.country;
  const svg = `<svg viewBox="0 0 30 20" xmlns="http://www.w3.org/2000/svg">${flags[e.country] || '<rect width="30" height="20" fill="#333"/>'}</svg>`;
  return `      <div class="calendar-event" data-country="${esc(country)}" data-tour="${esc(e.tour)}">
        <div class="ce-flag">${svg.replace(/\s*\n\s*/g, '')}</div>
        <div class="ce-body">
          <div class="ce-top"><span class="ce-name">${esc(e.name)}</span><span class="ce-tour">${esc(e.tour)}</span></div>
          <div class="ce-meta">${esc(e.city)}, ${esc(country)} · ${d(e.start)} – ${d(e.end)}</div>${resultHtml(e.result)}
        </div>
      </div>`;
}).join('\n');

const jsonItems = sorted.map((e, i) => {
  const country = names[e.country] || e.country;
  let desc = '';
  if (e.result) {
    desc = 'Vainqueur : ' + e.result.winner + '.';
    if (e.result.prizePool) desc += ' Prize pool ' + e.result.prizePool + (e.result.payout ? ', gain vainqueur ' + e.result.payout + '.' : '.');
    else if (e.result.payout) desc += ' Gain vainqueur ' + e.result.payout + '.';
  }
  const obj = {
    '@type': 'Event', position: i + 1, name: e.name, startDate: e.start, endDate: e.end,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: e.end < today ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled',
    location: { '@type': 'Place', name: e.city + ', ' + country },
  };
  if (desc) obj.description = desc;
  return '    ' + JSON.stringify(obj).replace(/":/g, '": ').replace(/,"/g, ', "').replace(/\{"/g, '{ "').replace(/"\}/g, '" }').replace(/\}\}/g, '} }');
}).join(',\n');

// 1. liste des événements
const listRe = /(<div class="calendar-list" id="calendar-list">\n)[\s\S]*?(\n    <\/div>\n    <p class="calendar-empty")/;
if (!listRe.test(page)) throw new Error('bloc calendar-list introuvable');
page = page.replace(listRe, (m, a, b) => a + listHtml + b);

// 2. JSON-LD (premier ItemList)
const ldRe = /("itemListElement": \[\n)[\s\S]*?(\n  \]\n\}\n<\/script>)/;
if (!ldRe.test(page)) throw new Error('JSON-LD introuvable');
page = page.replace(ldRe, (m, a, b) => a + jsonItems + b);

// 3. options de filtres : conserve l'ordre existant, ajoute les nouveautés
function addOptions(selectId, values){
  const re = new RegExp('(<select id="' + selectId + '"[^>]*>\\n)([\\s\\S]*?)(\\n        </select>)');
  const m = page.match(re);
  if (!m) throw new Error('select introuvable : ' + selectId);
  const present = new Set([...m[2].matchAll(/<option value="([^"]*)"/g)].map(x => x[1]));
  const extra = values.filter(v => !present.has(v)).map(v => `          <option value="${esc(v)}">${esc(v)}</option>`);
  if (extra.length) page = page.replace(re, (all, a, b, c) => a + b + '\n' + extra.join('\n') + c);
}
addOptions('calendar-country-filter', [...new Set(sorted.map(e => names[e.country] || e.country))]);
addOptions('calendar-tour-filter', [...new Set(sorted.map(e => e.tour))]);

fs.writeFileSync(pagePath, page);
console.log('calendrier.html régénéré :', sorted.length, 'événements,', sorted.filter(e => e.result).length, 'résultats');
