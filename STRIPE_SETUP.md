# Pokelo — Branchement Stripe (abonnements Pro / Équipe)

Ce document prépare le passage du plan "Pro" (et "Équipe") de "Bientôt disponible"
à un vrai abonnement payant. Rien n'est branché en production : il n'y a pas encore
de compte Stripe, donc rien ne peut débiter qui que ce soit. Ce qui est déjà prêt
côté code peut être activé en quelques minutes une fois le compte Stripe créé.

## 0. Ce qui est déjà prêt côté code

- **`api/create-checkout-session.js`** — crée une session Stripe Checkout (mode
  abonnement) pour un `priceId` donné, avec l'utilisateur Supabase authentifié
  comme `client_reference_id` (utilisé par le webhook pour retrouver le bon
  compte Pokelo).
- **`api/create-portal-session.js`** — ouvre le Billing Portal Stripe pour un
  client existant (gérer/annuler son abonnement, changer sa carte).
- **`api/stripe-webhook.js`** — reçoit les événements Stripe (`checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted`), vérifie la
  signature, et met à jour `profiles.plan` / `stripe_customer_id` /
  `stripe_subscription_id` dans Supabase via la clé service_role (jamais côté client).
- **Aucune dépendance npm** : les trois fonctions appellent l'API REST de Stripe
  directement en `fetch`, pas de `package.json`/`node_modules` à gérer.
- **Client (`index.html`)** : `currentPlan` est chargé depuis `profiles.plan` à la
  connexion, avec un helper `isPremium()` prêt à l'emploi mais **non branché à
  aucune restriction** pour l'instant — activer Stripe ne bloque rien tant que
  vous ne décidez pas explicitement quelles fonctionnalités réserver au plan payant.

## 1. Créer le compte Stripe et les produits

1. Créer un compte sur [stripe.com](https://stripe.com) (mode Test d'abord).
2. **Produits → Ajouter un produit** : "Pokelo Pro", prix récurrent mensuel
   (ex. 6€/mois). Noter le `Price ID` (commence par `price_...`).
3. Répéter pour "Pokelo Équipe" si besoin (ex. 14€/mois).
4. **Developers → API keys** : récupérer la clé secrète (`sk_test_...` en test,
   `sk_live_...` en prod) — ne jamais l'exposer côté client.
5. **Developers → Webhooks → Add endpoint** : URL = `https://pokelo.fr/api/stripe-webhook`,
   événements à écouter : `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Noter le "Signing secret" (`whsec_...`).

## 2. Variables d'environnement Vercel (Settings → Environment Variables)

```
STRIPE_SECRET_KEY       = sk_test_... (ou sk_live_... en prod)
STRIPE_WEBHOOK_SECRET   = whsec_...
STRIPE_PRICE_PRO        = price_...
STRIPE_PRICE_TEAM       = price_...
SUPABASE_URL            = https://uaeurizcwiaxrwcfwehm.supabase.co   (déjà utilisé par delete-account.js)
SUPABASE_SERVICE_ROLE_KEY = ...                                       (déjà utilisé par delete-account.js)
```

## 3. Migration SQL à exécuter dans Supabase (SQL Editor)

```sql
alter table public.profiles
  add column if not exists plan text not null default 'free',
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists stripe_subscription_status text,
  add column if not exists stripe_current_period_end timestamptz;
```

`stripe_current_period_end` est la date du prochain débit (fin de la période
en cours). Elle n'est écrite que par `api/stripe-webhook.js` (jamais par le
client) — c'est une donnée de facturation faisant autorité côté serveur.

## 4. Activer les boutons côté client

Dans `index.html`, section Tarifs (`#pricing`), le bouton du plan Pro est
actuellement :

```html
<button class="btn-primary" style="justify-content:center" disabled data-i18n="price_cta_soon">Bientôt disponible</button>
```

Une fois les Price ID et clés en place, remplacer par :

```html
<button class="btn-primary" style="justify-content:center" onclick="startCheckout('STRIPE_PRICE_PRO_ID_ICI')">S'abonner</button>
```

(remplacer par le vrai `price_...` ou mieux, le récupérer via un petit endpoint
`/api/prices` si vous préférez ne pas le coder en dur).

## 5bis. Parrainage (-30% premier mois / 1 mois offert)

Le système de parrainage est déjà câblé côté code (`api/create-checkout-session.js`,
`api/stripe-webhook.js`, voir SUPABASE_SETUP.md §7 pour la migration SQL). Il ne
manque qu'une chose à créer manuellement dans Stripe :

1. **Stripe → Produits → Coupons → Créer un coupon** :
   - Type : **Pourcentage**, valeur **30%**.
   - Durée : **Une fois** (`once`) — s'applique uniquement à la première facture.
   - ID du coupon : notez-le (ex. `REFERRAL30`).
2. **Vercel → Variables d'environnement** : ajouter `STRIPE_COUPON_REFERRAL30`
   avec cet ID.

Fonctionnement une fois branché :
- Chaque utilisateur a un code de parrainage automatique (visible dans
  Paramètres → Compte → Parrainage), dérivé de son identifiant.
- À l'inscription, un nouvel utilisateur peut renseigner le code d'un ami.
- S'il s'abonne à Pro pour la première fois **et** que son parrain est
  actuellement abonné Pro/Équipe, la remise de 30% s'applique automatiquement
  au checkout (aucune action manuelle du filleul).
- Une fois l'abonnement du filleul confirmé (webhook), le parrain reçoit un
  crédit de solde Stripe équivalent à 1 mois de Pro, appliqué automatiquement
  à sa prochaine facture (potentiellement 0€ à payer ce mois-là).
- Chaque parrainage ne peut déclencher qu'une seule remise et qu'une seule
  récompense (protégé par `referral_discount_used` / `referral_reward_claimed`).

## 5ter. Offrir des mois de Pokelo Pro à des amis (codes promo génériques)

Indépendamment du parrainage, `create-checkout-session.js` active
`allow_promotion_codes: true` dès qu'aucune remise de parrainage ne s'applique :
la page Stripe Checkout affiche alors un champ "Code promo" que n'importe qui
peut utiliser. Pour offrir un ou plusieurs mois à un ami précis :

1. **Stripe → Produits → Coupons → Créer un coupon** : 100% de réduction,
   durée "Plusieurs mois" (ex. 1 ou 3 mois selon le cadeau voulu).
2. **Stripe → Produits → Codes promotionnels → Créer un code promotionnel**,
   lié à ce coupon. Vous pouvez :
   - Fixer un **code personnalisé** (ex. `MERCI-JULIEN`) à transmettre en privé.
   - Limiter à **1 utilisation maximum** pour que le code ne soit utilisable
     qu'une fois.
   - Restreindre à une **adresse e-mail précise** si vous voulez être sûr que
     seul cet ami puisse s'en servir.
3. Partagez le code à votre ami : il le saisit sur la page Stripe Checkout au
   moment de s'abonner à Pokelo Pro.

## 6. Décider quoi réserver au plan payant

`isPremium()` (dans `index.html`) renvoie `true`/`false` selon `currentPlan`.
`PREMIUM_MODULES` est un tableau vide par défaut — y ajouter les identifiants de
modules du dashboard à réserver aux abonnés Pro (ex. `'riskOfRuin'`,
`'multiAccount'`...) est une décision produit à prendre volontairement, pas une
valeur par défaut imposée par cette préparation technique.
