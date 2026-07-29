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
3. Personnaliser les templates d'e-mail dans **Authentication → Email
   Templates** avec le branding Pokelo : coller le HTML de
   `supabase/email-templates/confirm-signup.html` dans le template
   "Confirm signup", et celui de `supabase/email-templates/reset-password.html`
   dans "Reset Password" (chaque fichier contient aussi le sujet suggéré en
   commentaire). Conservés ici pour ne pas avoir à les régénérer.
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
  add column if not exists is_public boolean not null default false,
  add column if not exists public_show_stats boolean not null default false;
```

Le profil public (`#/u/:id`) ne passe **jamais** par le client Supabase
directement : les policies RLS actuelles (`auth.uid() = id`) empêchent tout
visiteur anonyme de lire la table `profiles`, même avec `is_public = true`.
La route publique passe par `api/public-profile.js`, qui utilise la clé
service_role côté serveur et ne renvoie que `display_name` / `avatar_url` /
`created_at` — jamais l'email ni les données financières. Aucune policy RLS
supplémentaire n'est donc nécessaire pour cette fonctionnalité.

`public_show_stats` est un opt-in distinct de `is_public` : quand activé,
`api/public-profile.js` lit aussi `sessions` (via service_role, toujours
hors RLS côté client) mais n'en renvoie jamais que des agrégats calculés
côté serveur (nombre de sessions, winrate %, répartition par catégorie/
format en pourcentages) — jamais `buy_in`/`cashout` bruts, jamais de date,
lieu ni montant en euros.

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
  insert into public.profiles (id, email, display_name, referral_code, referred_by_user_id)
  values (new.id, new.email, nullif(trim(new.raw_user_meta_data->>'name'), ''), upper(substr(replace(new.id::text,'-',''),1,8)), ref_user_id);
  return new;
end;
$$ language plpgsql security definer;
```

> **Bug corrigé (2026-07-27)** : cette fonction n'a jamais recopié le nom saisi
> au formulaire d'inscription (`options.data.name` dans `signUp()`, atterrit
> dans `raw_user_meta_data`) vers `profiles.display_name` — le champ restait
> vide indéfiniment, donnant l'impression que le nom d'affichage "disparaissait"
> à la reconnexion alors qu'il n'avait en réalité jamais été enregistré. Si la
> fonction existe déjà en base avec l'ancienne définition (sans `display_name`),
> il suffit de relancer ce `create or replace function` — pas besoin de
> `drop trigger`/`create trigger`, le trigger existant pointe vers la même
> fonction. Les comptes déjà créés avant ce correctif sont rattrapés
> automatiquement côté client à la prochaine connexion (voir `completeSignInRun`
> dans `index.html`), sans action supplémentaire ici.

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
- **Créer/lister/désactiver un coupon + code promo Stripe** (`api/admin-promos.js`,
  GET = liste, POST `{action:'create'|'deactivate', ...}`) — utilise
  directement l'API Stripe (`STRIPE_SECRET_KEY`), le code généré fonctionne
  immédiatement grâce à `allow_promotion_codes` déjà actif sur le Checkout
  (voir STRIPE_SETUP.md §5ter). Regroupé dans un seul fichier (au lieu de 3
  endpoints séparés) pour rester sous la limite de 12 fonctions serverless
  du plan Hobby Vercel.

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

## 12. Numéro de téléphone du compte

À exécuter dans Supabase (SQL Editor) :

```sql
alter table public.profiles
  add column if not exists phone text,
  add column if not exists phone_country text;
```

`phone_country` stocke le code ISO du pays sélectionné dans la liste
déroulante (ex. `FR`), `phone` le numéro tel que saisi par l'utilisateur (pas
de normalisation E.164 stricte). Champ facultatif, jamais requis à
l'inscription.

## 13. Verrous serveur avant mise en production (critique)

Deux failles trouvées lors de l'audit avant lancement public — **à exécuter
avant toute publicité du site**, sans quoi elles sont exploitables dès
aujourd'hui par n'importe quel utilisateur technique, sans avoir besoin de
passer par l'interface.

### 13a. Auto-attribution du rôle admin / plan Pro (critique)

La policy `profiles: self only` (`auth.uid() = id`) autorise un utilisateur à
modifier N'IMPORTE QUELLE colonne de sa propre ligne, y compris `role` et
`plan` — RLS ne contrôle que la ligne (propriétaire), jamais les colonnes.
Le client ne propose jamais ces champs dans son propre formulaire, mais rien
n'empêche un appel direct à l'API REST Supabase (avec le propre jeton JWT de
l'utilisateur) du type :

```
PATCH /rest/v1/profiles?id=eq.<son-propre-id>
Body: {"role":"admin","plan":"pro"}
```

Cette requête est aujourd'hui acceptée. Le trigger ci-dessous neutralise
silencieusement toute tentative de modifier ces colonnes hors service_role
(donc hors fonctions serverless admin, qui utilisent la clé service_role et
restent donc inchangées) :

```sql
create or replace function public.protect_profile_privileged_columns()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    new.role := old.role;
    new.plan := old.plan;
    new.stripe_customer_id := old.stripe_customer_id;
    new.stripe_subscription_id := old.stripe_subscription_id;
    new.stripe_subscription_status := old.stripe_subscription_status;
    new.stripe_current_period_end := old.stripe_current_period_end;
    new.referral_reward_claimed := old.referral_reward_claimed;
    new.referral_discount_used := old.referral_discount_used;
    new.referred_by_user_id := old.referred_by_user_id;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_profile_privileged_columns_trigger on public.profiles;
create trigger protect_profile_privileged_columns_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();
```

Après ce trigger : un utilisateur peut toujours modifier `display_name`,
`avatar_url`, `phone`, `colors`, etc. normalement — seules les colonnes
listées ci-dessus reviennent silencieusement à leur valeur précédente si
quelqu'un d'autre que le service_role tente de les changer.

### 13b. Limite de bankrolls gratuite contournable (contournement produit)

La limite d'1 bankroll pour le plan gratuit n'est vérifiée que côté client
(`FREE_BANKROLL_LIMIT` dans `index.html`) — un appel direct à l'API permet
de créer autant de bankrolls que voulu sans jamais passer Pro :

```sql
create or replace function public.enforce_bankroll_limit()
returns trigger as $$
declare
  user_plan text;
  bankroll_count int;
begin
  if auth.role() = 'service_role' then
    return new;
  end if;
  select plan into user_plan from public.profiles where id = new.user_id;
  if user_plan is null or user_plan = 'free' then
    select count(*) into bankroll_count from public.bankrolls where user_id = new.user_id;
    if bankroll_count >= 1 then
      raise exception 'Limite de bankrolls atteinte pour le plan gratuit (1 maximum)';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists enforce_bankroll_limit_trigger on public.bankrolls;
create trigger enforce_bankroll_limit_trigger
  before insert on public.bankrolls
  for each row execute function public.enforce_bankroll_limit();
```

Le `1` en dur dans `bankroll_count >= 1` doit rester synchronisé avec
`FREE_BANKROLL_LIMIT` côté client si cette valeur change un jour.

Les autres limites "Pro" (export CSV, personnalisation du dashboard,
catégorie Expresso, seuils de stakes) ne portent que sur la présentation des
données déjà accessibles au propriétaire (pas de fuite vers un tiers, pas de
gain de fonctionnalité serveur) — les contourner ne casse rien côté sécurité
ou modèle de données, seulement l'incitation à passer Pro. Pas de verrou
serveur ajouté pour celles-ci : le rapport effort/risque ne le justifie pas.

## 14. Canal de support (mini QCM + suivi admin)

À exécuter dans Supabase (SQL Editor) — table des messages envoyés depuis le
formulaire de contact (accessible même sans compte, depuis le footer du
site) :

```sql
create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles(id),
  email text,
  category text not null,
  message text not null,
  status text not null default 'new'
);

alter table public.support_messages enable row level security;
-- Aucune policy client (ni select, ni insert) : la table n'est accessible
-- que via les fonctions serverless ci-dessous, qui utilisent la clé
-- service_role. Un visiteur anonyme peut envoyer un message (pas besoin de
-- compte), mais personne ne peut lire les messages des autres via le client
-- Supabase, y compris son propre message.
```

Deux fonctions Vercel :
- `api/support-submit.js` — publique (pas d'auth requise), insère le
  message. Si un jeton d'accès est fourni (utilisateur connecté), `user_id`
  et `email` sont renseignés automatiquement ; sinon le visiteur saisit son
  email dans le formulaire.
- `api/admin-support.js` — réservée au rôle admin (GET = liste, POST
  `{id, status}` = bascule le statut `new`/`read`). Regroupé en un seul
  fichier (au lieu de 2 endpoints séparés) pour rester sous la limite de 12
  fonctions serverless du plan Hobby Vercel.
