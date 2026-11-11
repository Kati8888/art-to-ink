# ART TO INK — Cloudflare-only commerce setup

The storefront commerce code is being migrated away from Supabase. The target architecture uses Cloudflare D1, a private Cloudflare R2 bucket, Stripe Checkout, and the existing Brevo transactional email integration.

## Cloudflare resources

Resource names and bindings:
- D1 database: `ART_TO_INK_DB`, binding `DB`
- R2 bucket: `ART_TO_INK_FILES`, binding `ARTWORK_FILES`

The R2 binding is declared in `wrangler.jsonc`. Create the bucket in the same Cloudflare account as the Worker:

```sh
npx wrangler r2 bucket create ART_TO_INK_FILES
```

Create the D1 database:

```sh
npx wrangler d1 create ART_TO_INK_DB
```

Wrangler prints a real database UUID. Add this exact value to `wrangler.jsonc` (do not use a placeholder):

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "ART_TO_INK_DB",
    "database_id": "PASTE_THE_REAL_UUID_FROM_WRANGLER"
  }
]
```

Apply the schema and initial product catalogue:

```sh
npx wrangler d1 execute ART_TO_INK_DB --remote --file=migrations/0001_cloudflare_commerce.sql
npx wrangler d1 execute ART_TO_INK_DB --remote --file=migrations/0002_seed_initial_catalogue.sql
```

## Server-side Worker variables and secrets

Set secrets with Wrangler or the Cloudflare dashboard. Never commit them to Git or paste them into chat.

Required:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BREVO_API_KEY`

Set a non-secret Worker variable:
- `BREVO_FROM_EMAIL` — a sender address verified in Brevo
- `NEXT_PUBLIC_SITE_URL` — the canonical HTTPS storefront URL

For example:

```sh
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put BREVO_API_KEY
```

Set `BREVO_FROM_EMAIL` and `NEXT_PUBLIC_SITE_URL` in Worker Variables in the Cloudflare dashboard.

## Stripe webhook

Configure a Stripe webhook endpoint at:

```
https://YOUR_CANONICAL_DOMAIN/api/webhooks/stripe
```

Subscribe to:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

Copy the endpoint signing secret into the Cloudflare Worker secret `STRIPE_WEBHOOK_SECRET`. Use Stripe test mode first.

## Private artwork files

The R2 bucket must remain private. Do not enable public bucket access or publish paid originals under `/public`.

The code checks for the exact R2 object before creating a Stripe Checkout Session. The initial catalogue expects object keys such as:

```
sea-dragons/sea-dragons-colour-1200.png
sea-dragons/sea-dragons-blackAndWhite-1200.png
sea-dragons/sea-dragons-colour-2000.png
sea-dragons/sea-dragons-blackAndWhite-2000.png
...
sea-dragons/sea-dragons-colour-complete-collection.zip
```

Equivalent keys are defined for the eight seeded products in `lib/secure-assets.ts`. Upload only the correct licensed original files. Do not upload gallery previews as paid originals unless they are the actual deliverables.

## Price catalogue

The seed migration uses the existing storefront prices: EUR 9, 19, 39, 79 and 149 for the four sizes and the complete-size ZIP package. The collection ZIP must exist in private R2 before it can be purchased. All checkout prices are loaded from D1, not from browser-submitted values.

## Important release gate

The schema and application code are groundwork; they do not create Cloudflare resources or upload the original artwork. Do not enable live payments until all of these are verified:

1. The D1 database and binding `DB` exist in the production Worker.
2. The private R2 bucket and binding `ARTWORK_FILES` exist.
3. Product/variant seed data is applied.
4. Every item marked purchasable has the correct private R2 object.
5. Stripe test-mode checkout succeeds for a multi-item guest order.
6. The Stripe webhook signature is verified and the D1 order becomes fulfilled.
7. The email arrives with working, expiring private download links.
8. Expired links, refunded orders, duplicate webhooks, and missing files fail safely.
9. The production build and Cloudflare deployment succeed.

No paid Cloudflare feature is required by this design. Check the current account limits before uploading large artwork files or enabling production traffic.
