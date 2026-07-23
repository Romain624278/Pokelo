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
