# ART TO INK — Cloudflare-only, no-R2 commerce setup

The storefront is being migrated away from Supabase and R2. The current low-cost architecture uses:
- Cloudflare D1 for products, orders, Stripe event IDs and download-token records.
- A private Cloudflare Workers KV namespace for artwork files. KV is not a public URL; the Worker serves files only after validating a hashed, expiring order token.
- Stripe Checkout for guest payments.
- Brevo for transactional delivery email.

## Cloudflare resources already created

Account resources:
- D1 database: `ART_TO_INK_DB`
- D1 binding: `DB`
- KV namespace: `ART_TO_INK_PRIVATE_FILES`
- KV namespace ID: `de03271ad6ff4435959f9e7d2581984a`
- Worker KV binding: `ARTWORK_FILES`

The Worker settings have been updated to include both `DB` and `ARTWORK_FILES`. The D1 schema and initial catalogue are provisioned. Current D1 state: 8 products, 80 variants, 0 variants enabled for purchase.

## Free-tier limits and safeguards

Cloudflare KV has a free allowance and overage pricing may apply if account usage exceeds it. Check the current Cloudflare Workers KV pricing and account usage before uploading. Each KV value has a 25 MiB maximum. The uploader resizes individual files and stops if any file exceeds 24 MiB. Do not enable public access or expose KV keys in client-side code.

## Prepare and upload artwork

Use the prepared package `ART_TO_INK_web_catalogue_ready.zip`. Extract it so the directory `ART_TO_INK_web_catalogue_ready` contains the eight product folders, each with `colour/original.png` and `black-and-white/original.png`.

Install project dependencies and authenticate Wrangler to the same Cloudflare account, then run:

```sh
ART_TO_INK_KV_NAMESPACE_ID=de03271ad6ff4435959f9e7d2581984a node scripts/upload-private-artwork-kv.mjs ./ART_TO_INK_web_catalogue_ready
```

The uploader writes four private PNG sizes per format and product. It does not activate the products in D1. Five of the eight image pairings are marked medium confidence in the package README; review those matches before enabling their product variants.

## Stripe and email secrets

Set secrets in the Cloudflare Worker settings, not in Git:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `BREVO_API_KEY`

Set non-secret Worker variables:
- `BREVO_FROM_EMAIL` — verified sender in Brevo
- `NEXT_PUBLIC_SITE_URL` — canonical HTTPS storefront URL

Subscribe the Stripe webhook at `https://YOUR_DOMAIN/api/webhooks/stripe` to:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`

Use Stripe test mode first.

## Release gate

Do not enable live purchases until:
1. The KV binding is present in the deployed Worker.
2. Correct files exist in KV for each enabled variant.
3. Product slug-to-artwork matching is approved.
4. Stripe secrets and webhook are configured.
5. A multi-item guest checkout succeeds in Stripe test mode.
6. The webhook creates expiring private links and the delivery email arrives.
7. Expired links, refunded orders, duplicate webhooks and missing files fail safely.
8. The latest production Worker build is verified.

R2 and Supabase are not required by this architecture. No paid upgrade has been enabled. KV has usage limits; monitor the account so usage does not exceed the included allowance.
