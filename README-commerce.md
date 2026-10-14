# ART TO INK commerce

The Next.js App Router commerce flow uses Stripe Checkout, verified Stripe webhooks, private Supabase Storage, expiring download tokens, and Resend transactional email. Product prices are read server-side from `lib/mock-data.ts`; the client never supplies a trusted price.

## Routes and services

- `app/api/checkout/route.ts` validates product, variant, intended use, file format, and the existence of the private artwork before creating a Checkout Session.
- `app/api/webhooks/stripe/route.ts` validates Stripe signatures against the raw request body, stores paid orders, and sends the English confirmation email.
- `app/api/download/issue/route.ts` verifies the paid Checkout Session and issues a random, hashed, seven-day download token.
- `app/api/download/[token]/route.ts` checks the token and order, creates a short-lived signed Storage URL server-side, and streams the file without exposing the storage URL.
- `app/thank-you/page.tsx` verifies the Checkout Session and displays the one-click download interface.
- `supabase/migrations/001_initial_schema.sql` creates the restricted orders table.
- `supabase/migrations/002_secure_download_links.sql` adds the artwork format and secure download link table.

## Required production configuration

1. Apply both SQL migrations to the Supabase project used by the site.
2. Create a **private** Storage bucket named by `SUPABASE_DOWNLOAD_BUCKET` (default recommendation: `tattoo-downloads`).
3. Upload the approved transparent artwork files to these exact private object keys:
   - `sea-dragons/sea-dragons-pure-colour.png`
   - `sea-dragons/sea-dragons-pure-bw.png`
4. Set the server-only environment variables from `.env.example` in local development and Vercel. Never use `NEXT_PUBLIC_` for secret keys.
5. Configure Stripe's webhook endpoint at `/api/webhooks/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, and set its signing secret as `STRIPE_WEBHOOK_SECRET`.
6. Configure a verified Resend sender domain and `RESEND_FROM_EMAIL`.
7. Run `npm run typecheck`, `npm run lint`, and `npm run build`; test in Stripe test mode before enabling live payments.

## Security behaviour

- Checkout refuses to start if the selected private artwork file is not present. No payment is taken in that case.
- Product, variant, price, and private object keys are validated server-side. The raw Storage object key is not included in Stripe metadata or browser responses.
- Download tokens are random, stored only as SHA-256 hashes, and expire after seven days. The Storage signed URL is short-lived and never returned to the browser.
- Supabase tables deny direct access to anonymous and authenticated clients; application code uses the server-only service-role key.
- All payment, webhook, and fulfillment failures are logged server-side and return safe user-facing errors. Stripe webhook failures return non-2xx responses so Stripe can retry.

Before live launch, configure Stripe tax and payment settings and review VAT, consumer rights, refund terms, privacy disclosures, and licence wording with qualified advisers.
