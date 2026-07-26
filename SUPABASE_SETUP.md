# Pokelo — Branchement Supabase + Vercel

Ce document prépare le passage de Pokelo (aujourd'hui 100% local, `localStorage`)
vers une vraie base de données multi-utilisateurs avec authentification, prête à
déployer sur Vercel. Rien ici n'est encore branché : c'est le plan d'exécution à
suivre le jour où vous créez le projet Supabase.

## 0. Ce qui est déjà prêt côté code

- **Couche d'accès aux données isolée** (`index.html`, section "data adapter") :
  toute l'app parle à un objet `DB` avec deux méthodes, `load()` et `save(state)`.
  Aujourd'hui `DB = LocalStorageAdapter`. Il suffira d'écrire un
  `SupabaseAdapter` qui respecte le même contrat et de faire
  `const DB = SupabaseAdapter;` — le reste de l'app (dashboard, modules,
  graphiques, i18n, etc.) n'a pas besoin de changer.
- **Écrans d'authentification** (`#/account`) : Connexion / Créer un compte /
  Mot de passe oublié sont déjà construits (formulaires, validation, tabs,
  routing). Les boutons affichent aujourd'hui un message "à venir" — il suffit
  de remplacer le contenu de `submitAccountForm()` par de vrais appels
  `supabase.auth.*` (voir §3).
- **Modèle de données stable** : `bankrolls` et `sessions` ont déjà la forme
  exacte des futures tables SQL (voir §1) — pas de migration de structure à
  prévoir, juste un changement de "lieu de stockage".

## 1. Schéma SQL à exécuter dans Supabase (SQL Editor)

```sql
-- Profils utilisateur (1 ligne par utilisateur, créée automatiquement à l'inscription)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  lang text default 'fr',
  theme text default 'dark',
  date_format text default 'fr-long',
  colors jsonb default '{}'::jsonb,
  dashboard_layout jsonb default '["evolution","monthly","recent"]'::jsonb,
  stake_thresholds jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Bankrolls
create table public.bankrolls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  currency text not null default 'EUR',
  start numeric not null default 0,
  color text,
  created_at timestamptz default now()
);

-- Sessions
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bankroll_id uuid not null references public.bankrolls(id) on delete cascade,
  category text not null check (category in ('tournament','cash','expresso')),
  format text not null check (format in ('live','online')),
  date date not null,
  time time,
  duration integer,
  tilt boolean default false,
  currency text not null default 'EUR',
  fx_rate numeric not null default 1,
  buy_in numeric not null default 0,
  cashout numeric not null default 0,
  bb numeric,
  hands integer,
  site text,
  variant text,
  notes text,
  created_at timestamptz default now()
);

create index on public.bankrolls (user_id);
create index on public.sessions (user_id);
create index on public.sessions (bankroll_id);
```

### Row Level Security (chaque utilisateur ne voit que ses propres données)

```sql
alter table public.profiles enable row level security;
alter table public.bankrolls enable row level security;
alter table public.sessions enable row level security;

create policy "profiles: self only" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "bankrolls: owner only" on public.bankrolls
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "sessions: owner only" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

### Création automatique du profil à l'inscription

```sql
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## 2. Authentification (Supabase Auth)

Dans **Supabase → Authentication → Providers** :
1. Activer **Email** (activé par défaut).
2. Activer **"Confirm email"** pour exiger la vérification d'adresse avant
   connexion (correspond à l'écran "Créer un compte" déjà présent côté app).
3. Personnaliser les templates d'e-mail (confirmation, reset password) dans
   **Authentication → Email Templates** — mettre le branding Pokelo.
4. Renseigner **Site URL** et **Redirect URLs** avec l'URL Vercel finale
   (ex. `https://pokelo.vercel.app`, plus `http://localhost:3000` en dev).

## 3. Code à brancher (remplace le stub actuel)

Ajouter le client Supabase (via CDN ESM, sans étape de build) :

```html
<script type="module">
  import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
  window.supabase = createClient(
    'https://VOTRE-PROJET.supabase.co',
    'VOTRE_CLE_ANON_PUBLIQUE'
  )
</script>
```

Remplacer l'adaptateur de données (section "data adapter" dans `index.html`) :

```js
const SupabaseAdapter = {
  async load(){
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: profile }, { data: bankrolls }, { data: sessions }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('bankrolls').select('*').eq('user_id', user.id),
      supabase.from('sessions').select('*').eq('user_id', user.id),
    ]);
    // Mapper les noms de colonnes snake_case -> camelCase utilisés par l'app
    // (bankroll_id -> bankrollId, fx_rate -> fxRate, buy_in -> buyIn, etc.)
    return mapSupabaseRowsToState(profile, bankrolls, sessions);
  },
  async save(state){
    // Pokelo sauvegarde tout l'état d'un coup (localStorage) ; avec Supabase,
    // préférer un save incrémental (upsert uniquement l'entité modifiée :
    // addModule/saveSession/saveBankroll appellent directement
    // supabase.from('sessions').upsert(...) plutôt que de tout ré-écrire).
  },
};
// const DB = SupabaseAdapter; // <- activer une fois prêt
```

Brancher les écrans d'auth déjà construits (`submitAccountForm` dans
`index.html`) :

```js
// Connexion
const { error } = await supabase.auth.signInWithPassword({ email, password });

// Inscription
const { error } = await supabase.auth.signUp({ email, password });
// -> Supabase envoie automatiquement l'e-mail de confirmation si activé (§2)

// Mot de passe oublié
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: 'https://pokelo.vercel.app/#/account/reset',
});
```

> **Important sur le save incrémental** : le modèle actuel réécrit tout
> `state` en une fois (`saveState()`), ce qui est parfait pour localStorage
> mais coûteux/risqué en base (écrasements concurrents, gros payloads). Lors
> du passage à Supabase, remplacer les appels `saveState()` par des appels
> ciblés (`upsert` sur la seule bankroll ou session modifiée, `delete` sur
> suppression) plutôt que de porter l'écriture "tout l'état" telle quelle.

## 4. Déploiement Vercel

1. `vercel.json` minimal (site 100% statique, pas de build) :
   ```json
   { "cleanUrls": true }
   ```
2. Pousser le repo sur GitHub, importer le projet dans Vercel.
3. Vercel détecte un site statique — aucune variable d'environnement n'est
   nécessaire côté serveur puisque la clé Supabase utilisée ici est la clé
   **anonyme publique** (protégée par les policies RLS, pas par le secret).
4. Ajouter le domaine Vercel dans Supabase (§2, Redirect URLs) avant de
   tester la connexion en production.

## 5. Migration des données locales existantes

Pour les utilisateurs qui ont déjà des données en `localStorage` avant
l'activation des comptes : proposer un bouton "Importer mes données locales"
qui lit `localStorage.getItem('pokelo_state_v1')` et pousse bankrolls/sessions
vers Supabase via des `insert` après la première connexion réussie — à
construire une fois l'auth réelle branchée.

## 6. Profil utilisateur (photo, nom d'affichage, partage public)

À exécuter dans Supabase (SQL Editor) — colonnes utilisées par la photo de
profil, le nom d'affichage et le partage de profil public :

```sql
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists is_public boolean not null default false;
```

Le profil public (`#/u/:id`) ne passe **jamais** par le client Supabase
directement : les policies RLS actuelles (`auth.uid() = id`) empêchent tout
visiteur anonyme de lire la table `profiles`, même avec `is_public = true`.
La route publique passe par `api/public-profile.js`, qui utilise la clé
service_role côté serveur et ne renvoie que `display_name` / `avatar_url` /
`created_at` — jamais l'email ni les données financières. Aucune policy RLS
supplémentaire n'est donc nécessaire pour cette fonctionnalité.

## 7. Parrainage (code, -30% / 1 mois offert)

À exécuter dans Supabase (SQL Editor) — ajoute le code de parrainage (dérivé
de l'UUID de l'utilisateur, donc généré automatiquement sans étape en plus),
le lien vers le parrain, et les deux indicateurs "déjà utilisé" qui empêchent
de rejouer la remise ou de payer deux fois la même récompense :

```sql
alter table public.profiles
  add column if not exists referral_code text,
  add column if not exists referred_by_user_id uuid references public.profiles(id),
  add column if not exists referral_discount_used boolean not null default false,
  add column if not exists referral_reward_claimed boolean not null default false;

create unique index if not exists profiles_referral_code_idx on public.profiles(referral_code);

-- Rétro-remplissage des comptes déjà existants
update public.profiles set referral_code = upper(substr(replace(id::text,'-',''),1,8)) where referral_code is null;

-- La fonction déclenchée à l'inscription (créée au §1) doit être remplacée
-- pour générer le code et résoudre le parrain à partir du code saisi au
-- moment de l'inscription (passé en metadata `referred_by_code`, voir
-- index.html → submitAccountForm('signup')) :
create or replace function public.handle_new_user()
returns trigger as $$
declare
  ref_code text := new.raw_user_meta_data->>'referred_by_code';
  ref_user_id uuid;
begin
  if ref_code is not null and length(trim(ref_code)) > 0 then
    select id into ref_user_id from public.profiles where referral_code = upper(trim(ref_code)) limit 1;
  end if;
  insert into public.profiles (id, email, referral_code, referred_by_user_id)
  values (new.id, new.email, upper(substr(replace(new.id::text,'-',''),1,8)), ref_user_id);
  return new;
end;
$$ language plpgsql security definer;
```

Le reste de la logique (vérifier que le parrain est bien Pro, appliquer la
remise -30% au checkout, créditer le mois offert) vit côté serveur dans
`api/create-checkout-session.js` et `api/stripe-webhook.js` — jamais dans le
client, pour qu'un utilisateur ne puisse pas se créditer lui-même. Voir
STRIPE_SETUP.md §6 pour le coupon Stripe à créer.

## 8. Rôle admin (visibilité globale + alertes d'erreur)

À exécuter dans Supabase (SQL Editor) — ajoute un rôle par utilisateur et une
table de journalisation des erreurs serveur (webhook Stripe, checkout,
parrainage), consultable uniquement par un compte admin :

```sql
alter table public.profiles
  add column if not exists role text not null default 'user';

create table if not exists public.error_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now(),
  source text not null,
  message text not null,
  context jsonb,
  user_id uuid references public.profiles(id)
);

alter table public.error_logs enable row level security;

-- Personne ne peut lire error_logs directement, même connecté : la table
-- n'est accessible que via la clé service_role (api/admin-stats.js), qui
-- contourne RLS et vérifie elle-même profiles.role = 'admin' avant de
-- répondre. Aucune policy SELECT n'est donc ajoutée volontairement.

-- Passer un compte en administrateur (remplacer l'email) :
update public.profiles set role = 'admin' where email = 'contact@pokelo.fr';
```

`role` n'est écrit que par vous-même via cette requête SQL manuelle — le
client (`syncPushToCloudRun`) ne l'inclut jamais dans ses upserts, donc un
utilisateur ne peut pas se l'attribuer lui-même. `api/admin-stats.js`
revérifie systématiquement `role` côté serveur avant de renvoyer quoi que ce
soit ; le fait que le menu admin s'affiche côté client n'est qu'un confort
d'UI, jamais le contrôle d'accès réel.

Le panneau admin (`#/app/admin`) permet aussi :
- **Attribuer/retirer Pokelo Pro** à un compte par email (`api/admin-grant-plan.js`)
  — modifie uniquement `profiles.plan`, ne touche jamais aux champs `stripe_*` :
  si ce joueur souscrit un jour un vrai abonnement, le webhook Stripe reprend
  la main normalement.
- **Créer un coupon + code promo Stripe** (`api/admin-create-promo.js`) —
  utilise directement l'API Stripe (`STRIPE_SECRET_KEY`), le code généré
  fonctionne immédiatement grâce à `allow_promotion_codes` déjà actif sur le
  Checkout (voir STRIPE_SETUP.md §5ter).

Les deux revérifient `role === 'admin'` côté serveur avant d'agir, comme
`api/admin-stats.js`.

## 9. Appareils de confiance (MFA à chaque connexion)

À exécuter dans Supabase (SQL Editor) — le MFA est désormais redemandé à
chaque connexion, sauf sur un appareil que l'utilisateur a explicitement
marqué de confiance après un code réussi :

```sql
create table if not exists public.trusted_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_id text not null,
  label text,
  created_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique (user_id, device_id)
);

alter table public.trusted_devices enable row level security;

create policy "trusted_devices: owner only" on public.trusted_devices
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Le client lit/écrit directement cette table via le client Supabase (comme
`bankrolls`/`sessions`) — la policy RLS garantit qu'un utilisateur ne peut
voir/modifier que ses propres appareils. `device_id` est un identifiant
aléatoire généré et stocké dans `localStorage` (pas un fingerprint) : il
identifie ce navigateur précis, pas la personne.

## 10. Seuils de stakes personnalisés (Pokelo Pro)

Si la table `profiles` a été créée avant l'ajout de cette fonctionnalité, il
manque la colonne `stake_thresholds` — à exécuter dans Supabase (SQL Editor) :

```sql
alter table public.profiles
  add column if not exists stake_thresholds jsonb default '{}'::jsonb;
```

Sans cette colonne, PostgREST rejette l'upsert `profiles` en entier (colonne
inconnue) : plus aucun réglage (langue, thème, couleurs, dashboard) ne se
synchronise tant que la migration n'est pas faite. Exécutez cette requête dès
que possible après la mise à jour du code.

## 11. Proposition MFA à la première connexion

À exécuter dans Supabase (SQL Editor) — sans cette colonne, l'écran "Sécuriser
votre compte" (activer le MFA ou passer) est réaffiché à **chaque** connexion
au lieu d'une seule fois, puisque le client ne peut pas savoir s'il a déjà été
présenté à ce compte :

```sql
alter table public.profiles
  add column if not exists mfa_setup_prompted boolean not null default false;
```

Comportement : à la première connexion d'un compte sans facteur MFA vérifié,
un écran propose de l'activer ou de reporter ("Plus tard"). Dans les deux cas,
`mfa_setup_prompted` passe à `true` et l'écran ne réapparaît plus. Si
l'utilisateur a choisi "Plus tard" (ou a fermé sans configurer), un
avertissement discret reste visible dans Paramètres → Mon compte, au niveau du
bouton d'activation du MFA, jusqu'à ce qu'il l'active réellement.
