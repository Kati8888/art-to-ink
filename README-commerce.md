# ART TO INK commerce foundation

This branch adds the first Next.js App Router commerce foundation alongside the existing static site. It is intentionally **not production-ready for accepting orders yet**: no design is published until its three image states and private download asset have been matched and checked. Checkout refuses unpublished designs rather than selling mismatched files.

## Structure

- `app/page.tsx` — English homepage and studio licence cards.
- `components/TattooDesignGallery.tsx` — accessible Colour / Black & White / On Skin gallery and pre-checkout intended-use confirmation.
- `lib/products.ts` — canonical `TattooDesign` TypeScript contract and licence catalogue.
- `lib/mock-data.ts` — safe catalogue data source; currently empty pending verified artwork mappings.
- `app/api/checkout/route.ts` — server-side Checkout Session creation; never trusts a client-supplied price.
- `app/api/webhooks/stripe/route.ts` — raw-body Stripe signature verification and payment fulfillment.
- `app/api/download/[token]/route.ts` — hash-verified, expiring download token; streams a private Storage object without exposing its URL.
- `supabase/migrations/001_initial_schema.sql` — order schema and restrictive row-level security.

## Required setup before testing payments

1. Create a Supabase project and apply the SQL migration.
2. Create a **private** Storage bucket (default name `tattoo-downloads`) and upload only approved transparent PNG/TIFF downloads.
3. Configure all server environment variables from `.env.example` in local development and Vercel. Never commit secrets.
4. In Stripe, configure a webhook endpoint at `/api/webhooks/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`; add its signing secret as `STRIPE_WEBHOOK_SECRET`.
5. Create and verify the three yearly recurring Stripe prices and set their Price IDs in the environment. Do not use test IDs in production.
6. Configure a verified Resend sender domain and `RESEND_FROM_EMAIL`.
7. Add each design to `lib/mock-data.ts` only after its matching colour, monochrome, skin mockup and private download file are visually verified; add the corresponding private object paths in `lib/secure-assets.ts`.
8. Run `npm install`, `npm run typecheck`, `npm run lint`, and `npm run build`. Test using Stripe test mode first, including webhook retries and expired download links.

## Important notes

- The current repository's image filenames do not consistently match their contents. This branch intentionally does not publish the existing mismatched image set as purchasable products.
- The email fulfillment path requires Supabase and Resend configuration; Stripe webhook responses stay unsuccessful when fulfillment fails so Stripe can retry. Monitor Stripe webhook delivery and Resend failures before launch.
- The `/thank-you` page retrieves the Checkout Session server-side. The download issuance endpoint additionally checks the email entered by the customer against the email on the verified Stripe session and only issues a link after fulfillment is complete.
- Review consumer law, VAT/tax settings, privacy disclosures, refunds and licence wording with qualified advisers before taking live payments.
