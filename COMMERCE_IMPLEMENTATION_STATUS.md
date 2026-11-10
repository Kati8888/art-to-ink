# ART TO INK — commerce implementation status

Working branch: `commerce-completion`

## Implemented in this branch
- Reviewed and hardened the additive commerce foundation migration.
- Protected profile admin privileges with column-level update grants.
- Preserved existing auth triggers by adding a separately named trigger only when absent.
- Scoped licence idempotency replays to the authenticated customer and licence.
- Added server-side validation that a licence activation's asset is active and belongs to the requested active product.
- Changed annual studio licence checkout to a one-time payment, not a recurring Stripe subscription.
- Added verified-email account sign-up/sign-in page and purchase claiming.
- Added account order and licence history.
- Added server endpoints for licence activation and short-lived private file delivery.
- Added idempotent order-item snapshots and tracked customer/owner transactional email delivery through Brevo.
- Added email-verified claiming of guest purchases into a customer account.
- Added private admin commerce dashboard for orders, recorded paid totals, customer accounts, and licences.
- Seeded catalogue product and size variant metadata in the migration without inventing storage assets.
- Kept Brevo as the transactional email provider.

## Still blocked / not complete
- The migration has NOT been applied to Supabase.
- Vercel production environment variables have not been independently verified.
- The existing private bucket `art-to-ink-originals` currently contains no objects.
- Secure assets cannot be registered until the matching original files are uploaded.
- Checkout remains intentionally unavailable for any design/size/format without a verified private object.
- No full production build or live Stripe/Brevo end-to-end test has been run.
- Persistent cart and cart-based checkout still need implementation and testing.
- Full refund lifecycle, licence expiry reminders, and full admin order actions still need implementation and testing.

## Data safety
No live Supabase tables, rows, policies, Storage objects, Stripe objects, Brevo settings, or production deployments were changed by these code edits. The migration file is prepared for manual review only.
