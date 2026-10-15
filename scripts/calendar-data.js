// Source de vérité du calendrier du poker mondial. Ces données ne sont plus
// embarquées dans index.html (la page /calendrier est statique) : elles servent
// uniquement à régénérer calendrier.html — voir scripts/generate-calendar-page.js.
// Dates fondées sur les annonces officielles des organisateurs ; un résultat
// n'est renseigné que s'il existe une source publiée fiable.
const POKER_CALENDAR_2026 = [
  { name:'WPT Seminole Hard Rock Lucky Hearts Poker Open', tour:'WPT', country:'US', city:'Hollywood, Floride', start:'2026-01-06', end:'2026-01-20', type:'majeur',
    result: { winner:'Giuseppe Iadisernia', prizePool:'3 932 800 $', payout:'611 700 $', source:'CardPlayer, CasinoCityTimes' } },
  { name:'Partouche Poker Deepstack — La Tour-de-Salvagny', tour:'Partouche', country:'FR', city:'La Tour-de-Salvagny', start:'2026-01-21', end:'2026-01-25', type:'circuit',
    result: { winner:'Nicolas Reder', prizePool:'124 608 €', payout:'25 000 €', source:'PokerNews FR, Live-Poker.com' } },
  { name:'WPT Cambodia', tour:'WPT', country:'KH', city:'Phnom Penh (NagaWorld)', start:'2026-01-21', end:'2026-02-03', type:'majeur',
    result: { winner:'Xiaosheng Zheng', prizePool:'1 500 000 $ GTD', payout:'244 500 $', source:'PokerNews' } },
  { name:"PokerStars Open Campione", tour:'PokerStars Open', country:'IT', city:"Campione d'Italia", start:'2026-01-23', end:'2026-02-01', type:'circuit',
    result: { winner:'Elvir Nuhiu', prizePool:'1 518 720 €', payout:'200 640 €', source:'CardPlayer' } },
  { name:'WPT Venetian Las Vegas Spring Championship', tour:'WPT', country:'US', city:'Las Vegas', start:'2026-02-09', end:'2026-02-24', type:'majeur',
    result: { winner:'Nicholas Seward', prizePool:'2 244 800 $', payout:'418 700 $', source:'PokerNews' } },
  { name:'EPT Paris', tour:'EPT', country:'FR', city:'Paris', start:'2026-02-18', end:'2026-03-01', type:'majeur',
    result: { winner:'Jorge Abreu', handle:'Jorginho88', prizePool:'7 075 200 €', payout:'1 148 600 €', source:'PokerNews, CardPlayer' } },
  { name:'Triton ONE Jeju', tour:'Triton', country:'KR', city:'Jeju', start:'2026-03-05', end:'2026-03-15', type:'highroller',
    result: { winner:'Zhao Wenjie', payout:'1 160 000 $', source:'PokerNews, CardPlayer' } },
  { name:'Triton Super High Roller Series Jeju (mars)', tour:'Triton', country:'KR', city:'Jeju', start:'2026-03-14', end:'2026-04-01', type:'highroller',
    result: { winner:'Ben Tollerene', handle:'Ben86', payout:'3 766 000 $', source:'PokerNews, tritonpokerseries.com' } },
  { name:'Irish Poker Open', tour:'Irish Poker Open', country:'IE', city:'Dublin', start:'2026-03-26', end:'2026-04-06', type:'majeur',
    result: { winner:'Narcis Nedelcu', handle:'Narcisus90', prizePool:'4 852 910 €', payout:'336 798 €', source:'PokerNews, PokerWired' } },
  { name:'WSOP Europe', tour:'WSOP Europe', country:'CZ', city:"Prague (King's Casino)", start:'2026-03-31', end:'2026-04-12', type:'majeur',
    result: { winner:'Marius Kudzmanas', prizePool:'13 085 000 €', payout:'2 000 000 €', source:'PokerNews, WSOP.com' } },
  { name:'WSOP Circuit — Pasino Partouche', tour:'WSOP Circuit', country:'FR', city:'Aix-en-Provence', start:'2026-04-10', end:'2026-04-21', type:'circuit',
    result: { winner:'Matthieu Cartillier', payout:'150 000 €', source:'Pokerology, Texapoker' } },
  { name:'Partouche Poker Deepstack — Divonne-les-Bains', tour:'Partouche', country:'FR', city:'Divonne-les-Bains', start:'2026-04-22', end:'2026-04-26', type:'circuit' },
  { name:'Aussie Millions', tour:'Aussie Millions', country:'AU', city:'Melbourne (Crown)', start:'2026-04-24', end:'2026-05-10', type:'majeur',
    result: { winner:'Malcolm Trayner', prizePool:'7 700 000 AUD', source:'PokerNews, ASGAM' } },
  { name:'EPT Monte-Carlo', tour:'EPT', country:'MC', city:'Monte-Carlo', start:'2026-04-30', end:'2026-05-10', type:'majeur',
    result: { winner:'Roman Stoica', prizePool:'4 903 350 €', payout:'825 000 €', source:'PokerNews, igaming.org' } },
  { name:'Triton Super High Roller Series Montenegro', tour:'Triton', country:'ME', city:'Sveti Stefan', start:'2026-05-13', end:'2026-05-28', type:'highroller',
    result: { winner:'Danny Tang', prizePool:'15 900 000 $', payout:'3 522 000 $', source:'PokerNews, CardPlayer' } },
  { name:'Riviera Poker Festival', tour:'Partouche', country:'FR', city:'Aix-en-Provence', start:'2026-05-08', end:'2026-08-05', type:'circuit' },
  { name:'PokerStars Open Namur', tour:'PokerStars Open', country:'BE', city:'Namur', start:'2026-05-27', end:'2026-06-07', type:'circuit',
    result: { winner:'Koen De Visscher', payout:'220 800 €', source:'PokerNews' } },
  { name:'World Series of Poker (WSOP)', tour:'WSOP', country:'US', city:'Las Vegas (Horseshoe & Paris)', start:'2026-05-26', end:'2026-07-15', type:'majeur',
    result: { winner:'Lucas Jumalon', prizePool:'85 600 000 $ (9 208 entrées)', payout:'10 000 000 $', source:'PokerNews, WSOP.com' } },
  { name:'WPT Cambodia — Passport to the World Championship', tour:'WPT', country:'KH', city:'Phnom Penh (NagaWorld)', start:'2026-08-12', end:'2026-08-24', type:'majeur',
    result: { winner:'Ari Engel', payout:'91 444 $', source:'SoMuchPoker' } },
  { name:'Triton Super High Roller Series Jeju (septembre)', tour:'Triton', country:'KR', city:'Jeju', start:'2026-09-04', end:'2026-09-17', type:'highroller',
    result: { winner:'Nick Schulman', prizePool:'19 600 000 $', payout:'3 854 888 $', source:'PokerNews, TightPoker' } },
  { name:'WPT Prime Australia', tour:'WPT', country:'AU', city:'Sydney (The Star)', start:'2026-09-10', end:'2026-09-30', type:'majeur',
    result: { winner:'Cooper Feltham', prizePool:'1 346 800 AUD', payout:'187 793 AUD', source:'PokerNews, SoMuchPoker' } },
  { name:'WPT Prime Lodge Championship', tour:'WPT', country:'US', city:'Austin, Texas', start:'2026-09-24', end:'2026-10-12', type:'majeur',
    result: { winner:'Shrikant Pillamarapu', payout:'148 527 $ (après deal ICM)', source:'PokerNews' } },
  { name:'WPT Seoul', tour:'WPT', country:'KR', city:'Séoul (INSPIRE)', start:'2026-10-30', end:'2026-11-09', type:'majeur' },
  { name:'PokerStars Open Aix-en-Provence', tour:'PokerStars Open', country:'FR', city:'Aix-en-Provence', start:'2026-11-01', end:'2026-11-08', type:'circuit' },
  { name:'EPT Prague', tour:'EPT', country:'CZ', city:'Prague', start:'2026-12-02', end:'2026-12-13', type:'majeur' },
  { name:'EPT Barcelona', tour:'EPT', country:'ES', city:'Barcelone', start:'2026-08-16', end:'2026-08-29', type:'majeur' },
  { name:'WPT Venetian Las Vegas Fall Festival', tour:'WPT', country:'US', city:'Las Vegas (The Venetian)', start:'2026-10-28', end:'2026-11-15', type:'majeur' },
  { name:'WPT World Championship', tour:'WPT', country:'US', city:'Las Vegas (Wynn)', start:'2026-11-27', end:'2026-12-21', type:'majeur' },
  { name:'WSOP Paradise', tour:'WSOP', country:'BS', city:'Bahamas', start:'2026-12-02', end:'2026-12-17', type:'majeur' },
  { name:'PokerStars Open Cannes', tour:'PokerStars Open', country:'FR', city:'Cannes', start:'2026-12-08', end:'2026-12-14', type:'circuit' },
];

const COUNTRY_NAMES = {
  fr: { US:'États-Unis', FR:'France', KH:'Cambodge', IT:'Italie', KR:'Corée du Sud', IE:'Irlande', CZ:'République tchèque', AU:'Australie', MC:'Monaco', ME:'Monténégro', BE:'Belgique', ES:'Espagne', BS:'Bahamas' },
  en: { US:'United States', FR:'France', KH:'Cambodia', IT:'Italy', KR:'South Korea', IE:'Ireland', CZ:'Czech Republic', AU:'Australia', MC:'Monaco', ME:'Montenegro', BE:'Belgium', ES:'Spain', BS:'Bahamas' },
};

module.exports = { POKER_CALENDAR_2026, COUNTRY_NAMES };
