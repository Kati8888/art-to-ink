# ART TO INK commerce configuration

This branch is prepared for the existing Supabase project and Brevo. Do not put server secrets in GitHub or any `NEXT_PUBLIC_*` variable.

## Required Vercel environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical HTTPS site URL |
| `SUPABASE_URL` | Existing Supabase project URL (server) |
| `NEXT_PUBLIC_SUPABASE_URL` | Same Supabase project URL (browser auth client) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role secret |
| `SUPABASE_DOWNLOAD_BUCKET` | Existing private bucket: `art-to-ink-originals` |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the Stripe webhook endpoint |
| `BREVO_API_KEY` | Existing Brevo API key |
| `BREVO_FROM_EMAIL` | Sender address verified in Brevo |
| `ADMIN_PASSWORD` | Strong unique administrator password |
| `ADMIN_SESSION_SECRET` | Random secret, at least 32 characters |

The current webhook code temporarily accepts `RESEND_FROM_EMAIL` as a fallback for the sender address, but new configuration should use `BREVO_FROM_EMAIL`.

## Stripe webhook

Configure the Stripe endpoint as:

`https://YOUR_DOMAIN/api/webhooks/stripe`

Subscribe to `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Use the webhook signing secret from that endpoint as `STRIPE_WEBHOOK_SECRET`.

Annual studio licences are intended to be one-time payments for a 12-month term (no automatic renewal).

## Private artwork storage

The existing bucket `art-to-ink-originals` is private. The live bucket currently has no artwork objects, so secure checkout correctly remains unavailable until original deliverable files are uploaded and their object paths are registered in `lib/secure-assets.ts` and `commerce_assets`.

Do not make this bucket public. Do not place paid originals in `public/` or GitHub.

## Deployment gate

Do not promote this branch to production until:
1. The reviewed migration has been applied to the existing Supabase project.
2. All environment variables above are configured in Vercel Production and Preview.
3. Verified Brevo sender is confirmed.
4. Private artwork originals are uploaded and checked.
5. Stripe test-mode purchase, webhook retry, account claiming, licence activation, and private download tests pass.
