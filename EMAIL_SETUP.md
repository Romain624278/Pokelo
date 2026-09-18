# Relances par e-mail — mise en place

Système de relance automatique : un e-mail est envoyé aux comptes inactifs
depuis 7 jours ou plus, jamais plus d'une fois tous les 14 jours, avec un
lien de désinscription en un clic. Déclenché chaque jour à 9h (UTC) par un
Cron Job Vercel qui appelle `api/reengagement.js`.

Rien de tout ça ne fonctionne tant que les étapes ci-dessous n'ont pas été
faites manuellement — impossible de créer un compte ou de configurer un DNS
à votre place.

## 1. Créer un compte d'envoi d'e-mails (Resend)

[Resend](https://resend.com) est utilisé ici : API simple (un seul appel
`fetch`, pas de dépendance npm à ajouter — cohérent avec le reste du projet
qui n'utilise que `fetch` pour Stripe/Supabase), et un plan gratuit large
(3 000 e-mails/mois, 100/jour) largement suffisant pour ce volume.

1. Créer un compte sur [resend.com](https://resend.com).
2. **Domains** → ajouter `pokelo.fr` → suivre les instructions pour ajouter
   les enregistrements DNS (SPF, DKIM) fournis, chez votre registrar/hébergeur
   DNS. Sans ce domaine vérifié, l'API refusera d'envoyer depuis
   `notifications@pokelo.fr` (utilisé dans `api/reengagement.js`) — en
   attendant la vérification DNS (propagation parfois sous 24-48h), les
   envois échoueront avec une erreur explicite dans les logs Vercel.
3. **API Keys** → créer une clé (droits d'envoi suffisent).

## 2. Variables d'environnement Vercel

Vercel → Project → Settings → Environment Variables :

- `RESEND_API_KEY` — la clé créée ci-dessus.
- `CRON_SECRET` — une chaîne aléatoire longue de votre choix (ex.
  `openssl rand -hex 32` en local, ou n'importe quel générateur de mot de
  passe). Sert à la fois à authentifier les appels du Cron Vercel (qui
  l'envoie automatiquement en en-tête `Authorization` dès que cette variable
  existe — rien à configurer côté Cron) et à signer les liens de
  désinscription dans les e-mails.

## 3. Migration Supabase

Deux colonnes sur `profiles`, à exécuter dans Supabase → SQL Editor :

```sql
alter table public.profiles add column if not exists reengagement_emails_enabled boolean not null default true;
alter table public.profiles add column if not exists last_reengagement_sent_at timestamptz;
```

`reengagement_emails_enabled` est aussi pilotable par l'utilisateur depuis
Réglages → Compte → E-mails (case à cocher, synchronisée comme le reste du
profil) — le lien de désinscription dans l'e-mail fait la même chose sans
connexion requise (jeton HMAC signé avec `CRON_SECRET`, vérifié par
`api/reengagement.js`).

## 4. Vérifier que le Cron est actif

Une fois déployé, Vercel → Project → Cron Jobs doit lister
`/api/reengagement` avec le prochain déclenchement prévu. Le plan Hobby
autorise ce type d'exécution quotidienne ; si vous êtes sur ce plan et que
le Cron n'apparaît pas, vérifiez les limites actuelles du plan dans le
dashboard Vercel (elles évoluent).

## 5. Tester manuellement

```bash
curl -H "Authorization: Bearer VOTRE_CRON_SECRET" https://www.pokelo.fr/api/reengagement
```

Répond `{ "checked": N, "sent": N, "errors": [] }`. Pour tester sans attendre
7 jours d'inactivité réelle, réduisez temporairement `INACTIVITY_DAYS` dans
`api/reengagement.js` sur un compte de test, puis remettez la valeur à 7
avant de repousser en prod.

## Réglages ajustables

Dans `api/reengagement.js` :
- `INACTIVITY_DAYS` (7 par défaut) — délai d'inactivité avant le premier
  rappel.
- `RESEND_THROTTLE_DAYS` (14 par défaut) — délai minimum entre deux rappels
  pour un même compte qui reste inactif.

Dans `vercel.json` (`crons`) : l'heure d'exécution (`"0 9 * * *"` = 9h UTC
chaque jour, syntaxe cron standard).
