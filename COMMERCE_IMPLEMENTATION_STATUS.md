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
- Added private admin commerce dashboard for orders, recorded paid totals, customer accounts, licences, and configurable package credit limits.
- Added a persistent authenticated cart with single-item checkout and automatic cart clearing after verified payment.
- Added daily 30-day and 7-day licence expiry reminders through Brevo, protected by `CRON_SECRET`.
- Seeded catalogue product and size variant metadata in the migration without inventing storage assets.
- Added a local upload script that checks the bucket is private, generates four sizes and ZIP collections, uploads the files, and registers their private paths.
- Added a GitHub Actions workflow for TypeScript, lint, and production-build validation.
- Kept Brevo as the transactional email provider.

## Still blocked / not complete
- Migration `003_commerce_foundation_review.sql` has been applied successfully to the existing Supabase project. Migration `004_profile_safe_updates.sql` has also been applied. The schema, seed counts, RLS flags, and profile policies were verified afterward.
- Vercel production environment variables have not been independently verified.
- The existing private bucket `art-to-ink-originals` currently contains no objects; the upload script is prepared but has not been run because the original 16-file artwork pack is not available in the current workspace.
- Secure assets cannot be registered until the matching original files are uploaded.
- Checkout remains intentionally unavailable for any design/size/format without a verified private object.
- No successful CI run, full production build, or live Stripe/Brevo end-to-end test has been confirmed. The connected Vercel account currently exposes only the `linuxio` project and cannot locate the `art-to-ink` project to verify or set its environment variables. Do not promote this branch until the correct Vercel team/project is accessible and configured.
- Persistent cart and cart-based checkout still need implementation and testing.
- Full refund lifecycle, licence expiry reminders, and full admin order actions still need implementation and testing.

## Data safety
No live Supabase tables, rows, policies, Storage objects, Stripe objects, Brevo settings, or production deployments were changed by these code edits. The migration file is prepared for manual review only.
