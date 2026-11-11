# ART TO INK — Cloudflare-only commerce setup (no Supabase)

This branch is being migrated away from Supabase. Do not configure or re-enable Supabase.

## Target architecture

- Next.js storefront on the existing Cloudflare Worker / OpenNext deployment.
- Cloudflare D1 binding: `DB` for catalogue publication metadata, paid orders, Stripe event idempotency, download entitlements, and email delivery records.
- Cloudflare R2 binding: `ARTWORK_FILES` for private original artwork and customer downloads.
- Stripe Checkout for payment collection.
- Existing transactional email provider integration, configured only with server-side secrets.
- Public preview images remain in the existing public asset paths; private purchase files must be stored in R2 and must never be served from a public URL.

## Resource names

- D1 database: `ART_TO_INK_DB` (binding name `DB`)
- R2 bucket: `ART_TO_INK_FILES` (binding name `ARTWORK_FILES`)

Create these resources in the Cloudflare dashboard or with Wrangler. Creating resources can require accepting Cloudflare's current terms; do not enable paid features or exceed free-tier limits.

## D1 schema

Apply `migrations/0001_cloudflare_commerce.sql` to the D1 database:

```sh
npx wrangler d1 execute ART_TO_INK_DB --remote --file=migrations/0001_cloudflare_commerce.sql
```

Before using remote commands, confirm that Wrangler is authenticated to the correct Cloudflare account and that the named database exists.

## Required Worker bindings

Configure the D1 and R2 bindings in the existing `wrangler.jsonc` after Cloudflare returns the actual D1 database ID. Never invent a database ID.

Expected binding names:
- D1: `DB`
- R2: `ARTWORK_FILES`

Do not make the R2 bucket public. Serve paid downloads through a server route that checks a one-time/expiring token hash in D1 and streams the matching private R2 object.

## Server-side secrets

Keep all secrets in Cloudflare Worker secrets, never in Git:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- transactional email provider API key and verified sender address

Never commit real credentials or ask the shop owner to paste them into chat.

## Important release gate

Checkout must remain disabled until all of the following are implemented and tested:
1. Server-side price and product validation from the canonical catalogue.
2. A Stripe Checkout Session for every valid cart item in one payment.
3. A signed Stripe webhook with event idempotency stored in D1.
4. Paid order persistence in D1.
5. Private R2 object existence checks before payment is offered.
6. Expiring download token hashes stored in D1 and private R2 streaming.
7. Idempotent customer email delivery with retry-safe state.
8. Test-mode payment, webhook retry, expired link, missing file, and multi-item order tests.

The SQL migration is infrastructure groundwork only. It does not by itself make checkout or delivery operational.
