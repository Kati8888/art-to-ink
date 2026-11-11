# ART TO INK commerce implementation status

## Completed in this pass

- Added a responsive, persisted customer cart at `/cart` with live header count, duplicate normalization, quantity controls, removal, empty/loading/error states, totals, and server-backed checkout submission.
- Added artwork and licence add-to-cart actions without enabling unavailable artwork.
- Updated `/api/checkout` to accept one or more cart items in a single Stripe Checkout Session.
- Added server-side validation against the live `commerce_products`, `commerce_variants`, `commerce_assets`, and `license_packages` records.
- Checkout totals come only from Supabase prices; client-provided prices are ignored.
- Design line items require an active `commerce_assets` row and a matching private Storage object before payment can start.
- Licence checkout uses one-time Stripe payment mode and live package prices/credit limits.
- Added Stripe line-item metadata for order-item snapshots.
- Updated the Stripe webhook to retrieve expanded line items, create/upsert the order and `order_items`, record Stripe event idempotency, and send a Brevo confirmation email.
- Brevo sender selection uses `BREVO_FROM_EMAIL` when present and the existing `RESEND_FROM_EMAIL` fallback; no second email service was added.
- Artwork downloads remain disabled because live `commerce_assets` is empty and the private bucket contains no originals.

## Targeted verification

- `git diff --check`: passed before this implementation pass.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed with five image warnings; no errors.
- `pnpm build`: passed. Next build reported the same five image warnings plus existing CSS optimizer warnings for escaped `@media` text in the generated storefront stylesheet.
- Browser verification: `/cart` rendered at the requested desktop dark viewport, and a persisted cart item survived reload and rendered in the checkout state.
- Live payment/webhook and Brevo delivery: not executed; doing so would create external payment/email side effects.

## Exact remaining blockers

1. Account registration, email verification, login, order history, licence balances, and customer-scoped downloads still require the project’s public Supabase Auth client configuration and authenticated UI/API session flow. The current repository has only the service-role server client and no existing auth routes.
2. Licence activation records require an authenticated customer UUID. Guest Stripe checkout currently records the order and line-item licence snapshot, but does not invent a customer or activate credits without an authenticated account linkage.
3. Admin order/customer/licence/refund views are not yet wired. Refund synchronization needs a deliberate admin authorization path and Stripe refund event handling.
4. `commerce_assets` and the private `art-to-ink-originals` bucket are empty. No artwork downloads or design payments are enabled until verified private originals are uploaded and mapped.
5. Brevo can be invoked from the webhook using `BREVO_API_KEY`, but a live email test was not sent to avoid creating an external side effect without an explicit test recipient.
