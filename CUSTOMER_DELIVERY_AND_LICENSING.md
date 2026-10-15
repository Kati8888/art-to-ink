# ART TO INK — customer delivery and studio licence workflow

Updated: 16 October 2026

## Customer purchase flow

1. Customer opens the ART TO INK catalogue and selects one artwork.
2. Customer selects a package (Mini €9, Small €19, Detailed €39, Premium €79, Collection €149), a colour or black-and-white file, and confirms intended use.
3. The site checks that the requested original exists in private Supabase Storage **before** creating a Stripe Checkout session. If the file is missing, checkout must stop without taking payment.
4. Stripe confirms payment through the signed webhook.
5. The webhook records the order, creates a random one-time download token, stores only its SHA-256 hash, and emails the customer a private download link that expires after seven days.
6. The email includes the selected artwork preview, design name, package, colour/B&W format, secure download link, and licence reminder.
7. A separate notification goes to the shop owner. It must never contain the private download token.
8. Duplicate Stripe webhook deliveries must not send duplicate fulfilment emails.

## Catalogue currently configured in code

All eight artwork entries now have catalogue previews and the five package options listed above:

1. Brain Heart — `brain-heart`
2. MRS Beer — `mrs-beer`
3. Assimilation — `sea-dragons`
4. Lion Heart — `lion-heart`
5. Grandparents — Babicka & Dedo — `babicka-dedo`
6. Faces Within — `faces-within`
7. Goodbye London — `goodbye-london`
8. War Inside — `war-inside`

## Critical fulfilment blocker — private original files

The private download map in `lib/secure-assets.ts` currently contains only the Assimilation / sea-dragons artwork. Its private bucket objects must exist in Supabase Storage. The other seven artworks must **not** be treated as ready for paid delivery until the matching transparent, high-resolution original files are uploaded to private storage and their object paths are added to `lib/secure-assets.ts`.

Public catalogue previews under GitHub or `public/assets` are for display only; never use a public preview URL as a paid download link. Confirm both colour and black-and-white originals before opening each product for checkout.

## Customer artwork email

Subject: `Your [Artwork Name] artwork is ready`

- Thank the customer and confirm payment.
- Show the matching preview image, artwork name, package and chosen format.
- Provide the seven-day secure download link.
- Explain that the purchase only grants the rights described by the applicable licence; no resale or redistribution of source files.
- Sign as Kateřina Pohnetalová, ART TO INK.
- If the link expires, customer replies to the email for help.

The Stripe webhook now personalizes this email and includes the selected catalogue preview. It also keeps the owner's payment notification separate.

## Studio licence tiers

- **Independent Artist Licence — €249/year:** one artist, up to five catalogue designs, one artist's client tattoo work.
- **Tattoo Studio Licence — €499/year:** up to five artists, up to 20 catalogue designs, one physical studio location.
- **Full Catalogue Studio Licence — €1,500/year:** all published designs, non-exclusive use at one studio location; copyright remains with the artist.

Licence does not transfer copyright. No source-file resale, redistribution, or sublicensing. The full-catalogue licence is non-exclusive, not ownership or exclusivity.

### Studio licence fulfilment

1. Customer pays through Stripe Checkout.
2. The signed webhook verifies payment and records the order as `license_active`.
3. Customer receives a confirmation email stating the purchased tier, price, scope and payment reference.
4. Owner receives a separate paid-order notification.
5. The customer keeps the email as proof of purchase and replies to register the artists/studio details if needed.
6. Keep a record of the Stripe customer/subscription ID, purchase date, tier, studio location, named artists, renewal/cancellation status, and any written scope changes.

## Stripe links previously supplied

These are the four links previously shared in the ART TO INK setup. Verify each link's live Stripe product, amount, and payment mode before using it in the catalogue:

- Signature Design — €39: https://buy.stripe.com/4gMbJ3eulahOa3q1ud9MY0j
- Premium Collection — €149: https://buy.stripe.com/28E4gBbi975Cb7uc8R9MY0k
- Tattoo Artist Licence — €249/year: https://buy.stripe.com/fZufZjbi99dK1wU2yh9MY0l
- Tattoo Studio Licence — €499/year: https://buy.stripe.com/5kQ00lcmdey40sQ6Ox9MY0m

These links do not yet cover every artwork/package combination, and no verified €1,500 full-catalogue Stripe link was found. The current website code creates Checkout sessions dynamically; do not paste these legacy links into every product without checking that their terms match the selected artwork and licence.

## Before declaring the shop fully live

- [ ] Upload and verify private high-resolution colour and B&W originals for all eight products.
- [ ] Add and test every private object path in `lib/secure-assets.ts`.
- [ ] Verify `SUPABASE_DOWNLOAD_BUCKET`, Supabase service credentials, `NEXT_PUBLIC_SITE_URL`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL` in the production environment.
- [ ] Verify the Stripe webhook endpoint is configured and receives `checkout.session.completed` events.
- [ ] Verify annual licence prices are the intended recurring or one-time prices. Current checkout code uses Stripe subscription mode for licences, which normally renews automatically; do not advertise “no automatic renewal” until this is deliberately changed and tested.
- [ ] Test successful payment, failed/cancelled payment, duplicate webhook, expired download link, and licence purchase with test-mode transactions.
- [ ] Confirm email delivery and spam placement, and ensure the customer email includes the correct preview and download.
- [ ] Publish clear licence terms, refund/cancellation policy, privacy notice, and applicable consumer information before accepting real orders.
