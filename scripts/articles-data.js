// Source de vérité pour la génération des pages statiques /blog/*.html —
// copie du tableau ARTICLES d'index.html (voir generate-blog-pages.js).
// Si un article est ajouté/modifié dans index.html, reporter le changement
// ici puis relancer `node scripts/generate-blog-pages.js`.
module.exports = [
  {
    slug: 'bankroll-management-regles-essentielles',
    tag: 'Bases',
    accent: 'green',
    type: 'guide',
    title: "Bankroll management : les règles essentielles pour ne jamais tomber à zéro",
    excerpt: "Les principes fondamentaux pour dimensionner votre bankroll et éviter le tapis, quel que soit votre format de jeu.",
    date: '2026-01-12',
    readTime: '9 min',
    content: `
      <p>Le bankroll management (BRM) est la discipline qui consiste à dimensionner vos mises par rapport à votre capital de jeu total, pour survivre à la variance inhérente au poker. Un joueur avec un edge positif peut malgré tout finir à zéro s'il joue trop gros par rapport à son roll : ce n'est pas une question de niveau de jeu, c'est une question de gestion.</p>
      <h2>Pourquoi la variance impose des règles strictes</h2>
      <p>Le poker est un jeu à somme variable sur le court terme. Même un très bon joueur en tournoi peut traverser des dizaines de tournois sans cash. Sans un roll suffisant, une série de résultats normaux statistiquement peut suffire à vous mettre hors jeu — définitivement, si vous devez redéposer de l'argent que vous ne pouviez pas vous permettre de perdre.</p>
      <h2>Les repères à connaître</h2>
      <ul>
        <li><strong>Cash game</strong> : viser 20 à 30 buy-ins pour le format que vous jouez, plus si vous êtes multi-tabling ou si votre style est à haute variance.</li>
        <li><strong>Tournois MTT</strong> : viser 50 à 100 buy-ins selon la taille des champs et votre volume de jeu.</li>
        <li><strong>Expresso / Spin&amp;Go</strong> : la variance liée aux multiplicateurs impose souvent 100+ buy-ins, même pour un joueur solide.</li>
      </ul>
      <p>Ces chiffres sont des ordres de grandeur, pas des lois gravées dans le marbre : ils dépendent de votre edge réel, de votre tolérance au risque, et du fait que le poker soit votre revenu principal ou un loisir.</p>
      <h2>Un exemple chiffré</h2>
      <p>Prenons un joueur de cash game NL10 (blinde à 0,10 €) avec une bankroll de 200 €, soit 20 buy-ins. Sur un mois, il perd 6 buy-ins d'affilée — une séquence tout à fait plausible statistiquement pour un joueur légèrement gagnant. Sa bankroll tombe à 140 €, soit 14 buy-ins : encore dans une zone raisonnable s'il descend temporairement en NL5, mais franchement tendue s'il continue à NL10 sans ajuster. C'est exactement ce type de scénario, banal sur le papier, qui fait sauter les bankrolls mal dimensionnées dès le départ (10-12 buy-ins par exemple), là où 20-30 buy-ins absorbent le choc sans drame.</p>
      <h2>Les erreurs qui cassent une bankroll</h2>
      <ul>
        <li><strong>Monter de limite après une bonne session</strong>, sur un échantillon bien trop petit pour confirmer un vrai edge à ce niveau.</li>
        <li><strong>Recharger la bankroll</strong> après chaque perte plutôt que de laisser les règles de move-down s'appliquer — ça masque le vrai état de votre jeu.</li>
        <li><strong>Mélanger bankroll de jeu et argent du quotidien</strong>, ce qui pousse à jouer des mises que vous ne pouvez pas vraiment vous permettre de perdre.</li>
        <li><strong>Ignorer les rebuys et add-ons</strong> dans le calcul du buy-in réellement engagé sur un tournoi.</li>
      </ul>
      <h2>La règle la plus simple à appliquer</h2>
      <p>Fixez-vous un plafond de mise en pourcentage de votre bankroll actuelle (pas de votre bankroll de départ), et redescendez de limite si vous passez sous ce seuil. C'est mécanique, ça retire l'émotion de la décision — et c'est précisément ce qu'un suivi rigoureux de vos sessions permet de vérifier objectivement plutôt qu'au feeling.</p>
      <h2>Par où commencer aujourd'hui</h2>
      <ul>
        <li>Notez votre bankroll actuelle et le buy-in moyen que vous jouez le plus souvent.</li>
        <li>Calculez votre nombre de buy-ins en réserve — c'est le chiffre à surveiller avant tout autre.</li>
        <li>Fixez par écrit votre seuil de move-down, avant d'en avoir besoin sous le coup de l'émotion.</li>
      </ul>
    `
  },
  {
    slug: 'combien-de-buyins-mtt',
    tag: 'Tournois',
    accent: 'amber',
    type: 'guide',
    title: "Combien de buy-ins faut-il pour jouer les MTT sereinement ?",
    excerpt: "La variance des tournois multi-tables est brutale. Voici comment calculer un nombre de buy-ins réaliste selon votre profil.",
    date: '2026-01-19',
    readTime: '8 min',
    content: `
      <p>Les tournois multi-tables (MTT) sont le format le plus exigeant en bankroll management : un joueur peut avoir un ROI très solide sur le long terme et pourtant enchaîner 15, 20, parfois 30 tournois sans cash. C'est mathématiquement normal, pas un signe que quelque chose ne va pas.</p>
      <h2>Pourquoi les MTT demandent plus de buy-ins que le cash game</h2>
      <p>Dans un tournoi, votre seul retour possible est un cash — souvent loin dans les places payées avant de rentrer dans votre mise. La distribution des résultats est donc très asymétrique : beaucoup de petites pertes, rarement un gros gain qui compense. Cette asymétrie augmente fortement l'écart-type de vos résultats.</p>
      <h2>Des repères selon votre volume</h2>
      <ul>
        <li><strong>Joueur occasionnel (1 à 5 MTT/semaine)</strong> : 60 à 80 buy-ins pour absorber les mauvaises séries sans devoir redescendre de limite.</li>
        <li><strong>Joueur régulier multi-tabling</strong> : 100+ buy-ins, car le volume élevé signifie que les séquences défavorables arrivent statistiquement plus vite.</li>
        <li><strong>Gros champs (1000+ joueurs)</strong> : ajoutez encore de la marge, la variance augmente avec la taille du champ.</li>
      </ul>
      <h2>Un calcul simple à faire soi-même</h2>
      <p>Prenez vos 50 à 100 derniers tournois : combien de fois avez-vous cashé, et pour quel multiple moyen de votre mise ? Un joueur qui cashe 15% du temps pour 3x sa mise en moyenne a un ROI positif sur le papier, mais peut très bien traverser 25 tournois secs d'affilée — la probabilité n'est pas négligeable dès que la fréquence de cash descend sous 20%. Faites le calcul avec vos propres chiffres plutôt qu'avec une moyenne générique : deux joueurs avec le même ROI peuvent avoir des profils de variance très différents selon leur style (bulle vs run profond, agressif vs solide).</p>
      <h2>Ce qui fait varier ces chiffres</h2>
      <ul>
        <li><strong>La taille des champs</strong> : plus il y a de joueurs, plus la variance entre deux tournois identiques augmente, même à ROI égal.</li>
        <li><strong>Votre style de jeu</strong> : un joueur qui privilégie les gros scores (min-cash rares, top 3 fréquents) a une variance plus élevée qu'un joueur qui sécurise des min-cashs réguliers.</li>
        <li><strong>Le format</strong> : turbo et hyper-turbo augmentent la variance par rapport aux structures lentes, à ROI comparable.</li>
      </ul>
      <h2>Erreur classique : sous-estimer une bad run</h2>
      <p>Beaucoup de joueurs remettent en question leur niveau de jeu après 15-20 tournois secs, alors que cette séquence est parfaitement compatible avec un edge positif réel. Le seul moyen de trancher objectivement est de regarder l'échantillon complet (ROI réel sur plusieurs mois, pas sur les 3 dernières semaines) plutôt que de juger sur l'émotion d'une mauvaise série récente.</p>
      <h2>Suivre plutôt que deviner</h2>
      <p>Le seul moyen de savoir si votre bankroll est réellement dimensionnée pour votre jeu est de suivre vos résultats sur plusieurs mois : ROI réel, fréquence de cash, taille moyenne des scores. Ces chiffres, une fois enregistrés session après session, remplacent l'intuition par des faits — et vous évitent de sous-estimer une bad run qui, statistiquement, était parfaitement prévisible.</p>
    `
  },
  {
    slug: 'cashgame-vs-tournoi-gestion-bankroll',
    tag: 'Stratégie',
    accent: 'violet',
    type: 'guide',
    title: "Cash game vs Tournoi : quelle gestion de bankroll adopter ?",
    excerpt: "Les deux formats n'ont pas la même variance ni la même logique de mise. Comparatif pratique pour adapter votre BRM.",
    date: '2026-01-26',
    readTime: '8 min',
    content: `
      <p>Cash game et tournoi ne se ressemblent qu'en apparence : les mêmes cartes, les mêmes règles de base, mais des dynamiques de bankroll totalement différentes. Confondre les deux logiques est une des erreurs de gestion les plus fréquentes chez les joueurs qui pratiquent les deux formats.</p>
      <h2>Cash game : une variance plus contenue</h2>
      <p>En cash game, vous pouvez recharger votre tapis, choisir votre table, et sortir dès que les conditions ne vous conviennent plus. Votre résultat par session est plus lisse, et 20 à 30 buy-ins suffisent généralement à un joueur discipliné pour tenir une limite donnée sans redescendre.</p>
      <h2>Tournoi : une variance structurellement plus forte</h2>
      <p>Un tournoi ne vous laisse pas le choix du moment où vous récupérez votre mise : soit vous cashez, soit vous perdez tout. Cette structure "tout ou rien" impose un roll bien plus large — souvent le double ou le triple du nombre de buy-ins nécessaires en cash game pour un edge comparable.</p>
      <h2>Un exemple concret</h2>
      <p>Deux joueurs avec 1000 € de bankroll : le premier joue exclusivement du cash game NL25 (25 € de tapis plein), soit 40 buy-ins — confortable. Le second joue des MTT à 20 € en moyenne, soit 50 buy-ins — déjà plus tendu pour ce format, et carrément insuffisant s'il vise des champs de plus de 500 joueurs. Avec la même somme au départ, le second joueur est objectivement en zone de danger là où le premier ne l'est pas — uniquement à cause du format joué, pas du niveau de jeu.</p>
      <h2>Le piège du joueur mixte</h2>
      <p>Si vous jouez les deux formats depuis la même bankroll globale, vous risquez de sous-estimer le risque réel : une bonne semaine de cash game peut masquer une bankroll MTT sous-dimensionnée. La solution la plus propre est de séparer vos rolls — un pour le cash, un pour les tournois — afin d'appliquer à chacun les règles de dimensionnement qui lui correspondent, et de visualiser clairement lequel des deux formats est réellement rentable pour vous.</p>
      <h2>Comment savoir où vous en êtes réellement</h2>
      <p>La seule façon fiable de comparer objectivement les deux formats est de suivre leurs résultats séparément : ROI par format, nombre de buy-ins en réserve propre à chacun, fréquence de move-down. Sans cette séparation, il est facile de croire qu'on "s'en sort bien" globalement alors qu'un seul des deux formats tire réellement les résultats vers le haut, l'autre étant en fait déficitaire ou simplement trop risqué pour la bankroll qui lui est allouée.</p>
    `
  },
  {
    slug: 'expresso-spin-go-variance',
    tag: 'Expresso',
    accent: 'critical',
    type: 'guide',
    title: "Expressos / Spin & Go : gérer la variance de la loterie",
    excerpt: "Le multiplicateur aléatoire rend les expressos passionnants — et statistiquement violents pour une bankroll mal calibrée.",
    date: '2026-02-02',
    readTime: '7 min',
    content: `
      <p>Les expressos (Spin&amp;Go et équivalents) ajoutent un multiplicateur de prizepool tiré au sort avant le début du tournoi. Cette mécanique de loterie change complètement le profil de variance par rapport à un tournoi classique : la grande majorité de vos gains à long terme proviendra d'une minorité de tournois où le gros multiplicateur tombe.</p>
      <h2>Une distribution extrême</h2>
      <p>Statistiquement, vous perdrez votre mise dans la grande majorité des expressos joués, et rattraperez ces pertes via de rares multiplicateurs élevés combinés à une victoire. Cette distribution très étirée est plus violente que celle des MTT classiques, et impose donc un nombre de buy-ins encore plus élevé pour absorber les longues séquences sans le gros multiplicateur.</p>
      <h2>Un exemple qui parle</h2>
      <p>Sur 100 expressos à 10 €, un joueur peut très bien remporter 0 gros multiplicateur (x100 ou plus) et terminer en perte sur l'échantillon, alors que son edge réel est positif sur le très long terme. Ce n'est qu'au bout de plusieurs centaines, voire milliers de parties que la fréquence réelle des gros multiplicateurs se rapproche des probabilités théoriques annoncées par l'opérateur. Juger sa rentabilité sur 50 ou 100 parties sur ce format n'a statistiquement presque aucun sens.</p>
      <h2>Ce qu'il faut suivre de près</h2>
      <ul>
        <li>Votre <strong>ROI réel</strong> sur un échantillon large (plusieurs centaines de parties minimum, l'échantillon nécessaire pour juger un ROI en expresso est plus grand qu'en cash game).</li>
        <li>La fréquence des gros multiplicateurs obtenus, pour distinguer une bad run normale d'un problème de niveau de jeu.</li>
        <li>Votre résultat net sur des paliers de mise différents, si vous jouez plusieurs niveaux de buy-in.</li>
      </ul>
      <h2>Combien de parties avant de juger son niveau</h2>
      <p>À titre indicatif, il faut généralement plusieurs milliers de Spin&amp;Go pour qu'un ROI se stabilise statistiquement, contre quelques centaines de tournois classiques. Si vous n'avez pas ce volume, la prudence s'impose : ni excès de confiance après une bonne série de gros multiplicateurs, ni remise en question après une série sèche — les deux peuvent être de simples artefacts de variance sur un échantillon encore trop petit.</p>
      <p>Sans suivi précis, il est presque impossible de distinguer objectivement une variance normale d'un vrai problème de rentabilité sur ce format — d'où l'intérêt d'enregistrer chaque partie plutôt que de se fier à une impression générale.</p>
    `
  },
  {
    slug: 'live-vs-online-adapter-bankroll',
    tag: 'Stratégie',
    accent: 'blue',
    type: 'guide',
    title: "Live vs Online : adapter sa bankroll selon le format",
    excerpt: "Rythme de jeu, niveau moyen, structure des mises : le live et l'online n'exposent pas votre bankroll de la même façon.",
    date: '2026-02-09',
    readTime: '7 min',
    content: `
      <p>Un même type de partie — disons un cash game NLHE — n'expose pas votre bankroll de manière identique selon que vous jouez en live ou en ligne. Le rythme de jeu, la profondeur de lecture des adversaires, et le nombre de mains jouées par heure changent la donne.</p>
      <h2>Le online : plus de mains, donc plus vite la variance se manifeste</h2>
      <p>En ligne, vous jouez beaucoup plus de mains par heure, souvent en multi-tabling. Votre échantillon de résultats grossit vite, ce qui est une bonne nouvelle pour juger votre niveau réel rapidement, mais signifie aussi que les séquences défavorables arrivent statistiquement plus tôt dans votre parcours.</p>
      <h2>Le live : moins de volume, plus de biais de perception</h2>
      <p>En live, le faible nombre de mains jouées par session rend chaque résultat individuel moins significatif statistiquement, mais psychologiquement plus marquant. Un joueur peut se sentir "en forme" ou "à côté" sur la base d'un échantillon bien trop petit pour être fiable.</p>
      <h2>Un exemple parlant</h2>
      <p>Un joueur en ligne sur 4 tables peut voir passer 400 mains à l'heure ; en live, une soirée de 4 heures dans un cercle ou un casino tourne plutôt autour de 120 à 150 mains au total. Il faut donc environ 10 à 15 sessions live pour accumuler l'équivalent d'une seule heure de jeu multi-table en ligne. Juger son niveau après trois soirées live revient à peu près à juger son niveau après 30 minutes de jeu en ligne — dans les deux cas, l'échantillon est trop petit pour trancher quoi que ce soit.</p>
      <h2>Comment adapter concrètement votre emploi du temps</h2>
      <p>Si votre suivi révèle que vous êtes nettement plus rentable dans un format, cela ne veut pas forcément dire qu'il faut abandonner l'autre : cela peut simplement indiquer un ajustement à faire (moins de tables en ligne pour mieux lire vos adversaires, ou des sessions live plus courtes si la fatigue dégrade votre jeu après 2-3 heures). L'objectif n'est pas de sacrifier un format que vous aimez, mais de savoir précisément ce qu'il vous coûte ou vous rapporte réellement avant de décider où investir votre temps de jeu.</p>
      <h2>La bonne pratique : séparer le suivi, pas forcément le roll</h2>
      <p>Même si vous jouez depuis une seule bankroll, suivre séparément vos statistiques live et online (winrate, ROI, volume de sessions) vous permet de savoir objectivement où votre jeu est le plus rentable — et d'ajuster votre temps de jeu en conséquence plutôt que de vous fier à une impression générale forcément biaisée par le format le plus récent joué.</p>
    `
  },
  {
    slug: 'suivre-statistiques-poker-pourquoi-comment',
    tag: 'Bases',
    accent: 'green',
    type: 'guide',
    title: "Suivre ses statistiques poker : pourquoi et comment",
    excerpt: "Le suivi de résultats n'est pas réservé aux professionnels. Voici ce qu'il faut enregistrer, et pourquoi ça change tout.",
    date: '2026-02-16',
    readTime: '9 min',
    content: `
      <p>La plupart des joueurs surestiment leur mémoire de leurs propres résultats : on se souvient bien mieux d'un bad beat marquant que d'une série de petites victoires régulières. Sans suivi écrit, votre perception de votre niveau réel est presque toujours biaisée — souvent vers le pessimisme après une session difficile, parfois vers l'excès de confiance après un gros score.</p>
      <h2>Ce qu'un suivi minimal doit contenir</h2>
      <ul>
        <li>La <strong>date</strong> et le <strong>format</strong> (tournoi, cash game, expresso — live ou online).</li>
        <li>La <strong>mise engagée</strong> et le <strong>gain final</strong>, pour calculer un résultat net exact plutôt qu'approximatif.</li>
        <li>Le <strong>site ou lieu</strong> de jeu, utile pour repérer si un environnement particulier vous réussit mieux qu'un autre.</li>
      </ul>
      <h2>Les métriques qui comptent vraiment</h2>
      <p>Au-delà du simple profit/perte, quelques indicateurs permettent de vraiment comprendre votre jeu :</p>
      <ul>
        <li><strong>ROI</strong> : votre profit net rapporté à la mise totale engagée — la mesure de référence en tournoi.</li>
        <li><strong>Winrate</strong> : la proportion de vos sessions qui se terminent en gain, pour repérer un déséquilibre entre fréquence de gain et taille des gains.</li>
        <li><strong>ITM %</strong> (in the money) : le pourcentage de tournois où vous finissez dans les places payées, un bon complément au ROI pour juger votre régularité.</li>
        <li><strong>BB/100</strong> en cash game : le gain en big blinds pour 100 mains jouées, la métrique standard qui permet de comparer votre winrate indépendamment de la limite jouée.</li>
      </ul>
      <h2>Ce que ça révèle, session après session</h2>
      <p>Avec quelques dizaines de sessions enregistrées, des tendances apparaissent que l'intuition seule ne peut pas détecter fiablement : un format plus rentable qu'un autre, un créneau horaire à éviter, une dérive progressive de votre bankroll qui serait passée inaperçue au jour le jour.</p>
      <h2>Un rituel simple de 2 minutes</h2>
      <p>La barrière principale au suivi n'est pas la complexité, c'est l'oubli. Le rituel le plus efficace tient en trois étapes, à faire juste après la session pendant que les chiffres sont encore frais : noter la mise et le gain, cocher le type et le format, ajouter une note d'une ligne si quelque chose a particulièrement influencé le résultat (table difficile, fatigue, tilt). Fait systématiquement, ce rituel de deux minutes produit, au bout d'un mois, un historique bien plus fiable que n'importe quel souvenir a posteriori.</p>
      <h2>La discipline plutôt que la perfection</h2>
      <p>Il ne s'agit pas de noter chaque main jouée, mais d'enregistrer systématiquement chaque session — buy-in, gain, quelques minutes après la fin de la partie. C'est cette régularité, plus que la précision extrême, qui transforme un tableau de chiffres en un véritable outil de décision pour ajuster vos limites de jeu et votre discipline de bankroll management.</p>
    `
  },
  {
    slug: 'calendrier-tournois-live-2026-preparer-bankroll',
    tag: 'Actualité',
    accent: 'amber',
    type: 'news',
    title: "Calendrier des tournois live 2026 : comment préparer sa bankroll pour la saison",
    excerpt: "WSOP, EPT, circuits nationaux : la saison live s'étale sur toute l'année. Comment planifier son budget sans se mettre en danger.",
    date: '2026-03-02',
    readTime: '6 min',
    content: `
      <p>Chaque année, le calendrier du poker live s'articule autour de quelques grands rendez-vous récurrents : les World Series of Poker (WSOP) à Las Vegas l'été, la tournée European Poker Tour (EPT) sur plusieurs étapes en Europe, et une multitude de circuits nationaux et de festivals de casino tout au long de l'année. Pour un joueur qui veut caler ses déplacements sur cette saison sans déséquilibrer sa bankroll, la planification compte autant que le jeu lui-même.</p>
      <h2>Anticiper le coût réel d'un déplacement</h2>
      <p>Le buy-in du tournoi principal n'est souvent qu'une fraction du budget réel : transport, hébergement sur plusieurs jours, repas, et éventuels re-entries ou side events gonflent vite la facture. Beaucoup de joueurs découvrent ce coût réel a posteriori, ce qui fausse leur perception de rentabilité du déplacement.</p>
      <h2>Séparer bankroll de jeu et budget de déplacement</h2>
      <p>Une pratique saine consiste à budgétiser le déplacement (transport, logement) comme une dépense de loisir séparée, et à ne faire porter la logique stricte de bankroll management que sur les buy-ins eux-mêmes. Mélanger les deux pousse souvent à sur-jouer des side events pour "rentabiliser" le voyage, ce qui va à l'encontre d'une gestion saine.</p>
      <h2>Pourquoi suivre son calendrier de jeu, pas seulement ses résultats</h2>
      <p>Savoir combien d'événements vous avez joués sur une saison, avec quel volume de buy-ins cumulés, aide à replacer une bad run dans son contexte réel : un mauvais mois sur trois gros festivals consécutifs n'a pas la même signification statistique qu'un mauvais mois sur trente petits tournois locaux étalés dans l'année.</p>
      <h2>À retenir avant de partir</h2>
      <ul>
        <li>Fixez le nombre de buy-ins que vous êtes prêt à jouer sur le festival, à l'avance et par écrit.</li>
        <li>Budgétisez transport et hébergement séparément de la bankroll de jeu.</li>
        <li>Enregistrez chaque session du déplacement pour analyser sa rentabilité réelle une fois rentré, plutôt que sur une impression à chaud.</li>
      </ul>
    `
  },
  {
    slug: 'tendances-poker-en-ligne-2026',
    tag: 'Actualité',
    accent: 'blue',
    type: 'news',
    title: "Poker en ligne : les tendances qui redessinent le jeu",
    excerpt: "Formats rapides, marketplaces de staking, outils d'analyse démocratisés : un tour d'horizon des évolutions qui changent la manière de jouer et de suivre sa bankroll.",
    date: '2026-03-16',
    readTime: '6 min',
    content: `
      <p>Le poker en ligne évolue en permanence, porté par de nouveaux formats et de nouveaux outils. Sans prétendre à l'exhaustivité, quelques tendances de fond changent concrètement la façon dont les joueurs abordent leur bankroll.</p>
      <h2>La montée des formats rapides</h2>
      <p>Expressos, Spin & Go et autres formats à multiplicateur aléatoire occupent une place de plus en plus centrale dans l'offre des salles en ligne. Leur variance particulière (voir notre article dédié) impose des règles de bankroll management différentes des tournois classiques, ce qui pousse de plus en plus de joueurs à séparer leurs rolls par format plutôt que de tout regrouper.</p>
      <h2>Les marketplaces de staking</h2>
      <p>Les plateformes qui mettent en relation joueurs et investisseurs pour du staking (financement partiel ou total d'un buy-in contre un pourcentage des gains) se sont largement démocratisées. Elles changent la donne pour la gestion de bankroll : un joueur staké gère en réalité deux bankrolls distinctes — la sienne et celle, virtuelle, des parts vendues — qu'il est utile de suivre séparément pour ne pas fausser sa perception de rentabilité personnelle.</p>
      <h2>Des outils d'analyse plus accessibles</h2>
      <p>Les solveurs GTO et les trackers de statistiques, longtemps réservés à un cercle de joueurs technophiles ou professionnels, sont aujourd'hui accessibles à un public beaucoup plus large. Cette démocratisation relève le niveau moyen, ce qui a une conséquence directe sur la bankroll : les marges de profit se resserrent, et un dimensionnement prudent devient plus important qu'auparavant, pas moins.</p>
      <h2>Ce qui ne change pas</h2>
      <p>Malgré ces évolutions, le principe de base reste identique : sans suivi rigoureux de ses résultats, il est impossible de distinguer objectivement un vrai edge d'une variance favorable temporaire, quel que soit le format ou l'outil utilisé.</p>
    `
  },
  {
    slug: 'fiscalite-gains-poker-france',
    tag: 'Actualité',
    accent: 'violet',
    type: 'news',
    title: "Fiscalité des gains de poker en France : ce qu'il faut savoir",
    excerpt: "Joueur occasionnel ou habituel, la frontière fiscale n'est pas qu'une formalité. Tour d'horizon des grands principes — et pourquoi ce n'est pas un conseil personnalisé.",
    date: '2026-04-06',
    readTime: '5 min',
    content: `
      <p>La question revient régulièrement chez les joueurs qui commencent à suivre sérieusement leurs résultats : mes gains de poker sont-ils imposables ? En France, la réponse dépend avant tout du caractère occasionnel ou habituel de la pratique — ce texte présente les grands principes généralement admis, mais ne constitue en aucun cas un conseil fiscal personnalisé.</p>
      <h2>Le principe général pour un joueur occasionnel</h2>
      <p>En France, les gains issus du hasard (jeux de casino, paris, loteries) perçus par un joueur occasionnel ne sont en principe pas soumis à l'impôt sur le revenu, le poker étant traditionnellement rattaché à cette famille de jeux par l'administration fiscale et la jurisprudence. Cette non-imposition concerne l'activité de loisir, pas une activité exercée de manière habituelle et organisée.</p>
      <h2>La frontière avec l'activité "habituelle"</h2>
      <p>La qualification change si l'activité est exercée de façon régulière, organisée et significative en termes de revenus — la frontière exacte s'apprécie au cas par cas selon la fréquence de jeu, le volume de gains, et le degré de professionnalisation (par exemple, vivre principalement de ses gains de poker). Dans ce cas, une requalification en bénéfices non commerciaux (BNC) est possible, avec les obligations déclaratives et sociales qui en découlent.</p>
      <h2>Pourquoi un suivi précis devient utile</h2>
      <p>Qu'un joueur reste clairement occasionnel ou se rapproche d'une pratique plus régulière, disposer d'un historique précis de ses sessions, buy-ins et résultats nets est utile dans les deux cas : pour objectiver son statut réel si la question se pose, et pour avoir une vision claire de sa situation en cas d'échange avec un professionnel du chiffre.</p>
      <h2>Ce que cet article n'est pas</h2>
      <p>Ce texte présente des principes généraux, pas un conseil fiscal individualisé : la situation de chaque joueur dépend de faits précis (fréquence, volumes, autres revenus) qui ne peuvent être évalués que par un professionnel (expert-comptable, avocat fiscaliste) au vu de votre situation réelle.</p>
    `
  }
];
