# ART TO INK — private artwork upload checklist

This is the handoff for putting the artwork files from `ART_TO_INK_customer_artwork_pack_compact.zip` into the private Supabase Storage bucket used by the live checkout.

## Important
- Do not put paid originals in `public/` or use public GitHub image URLs as download links.
- Keep the bucket private.
- The archive includes original colour source images and grayscale-derived versions. The grayscale versions are not manually redrawn tattoo stencils.
- Uploading files alone does not configure Stripe, Resend, the webhook, or database schema.

## Files to upload
Extract the ZIP. The upload script expects these paths inside the extracted folder:

- `brain-heart/brain-heart-colour-source.png`
- `brain-heart/brain-heart-black-white-derived.png`
- `mrs-beer/mrs-beer-colour-source.png`
- `mrs-beer/mrs-beer-black-white-derived.png`
- `sea-horses/sea-horses-colour-source.png`
- `sea-horses/sea-horses-black-white-derived.png`
- `lion-heart/lion-heart-colour-source.png`
- `lion-heart/lion-heart-black-white-derived.png`
- `grandparents/grandparents-colour-source.png`
- `grandparents/grandparents-black-white-derived.png`
- `faces-within/faces-within-colour-source.png`
- `faces-within/faces-within-black-white-derived.png`
- `goodbye-london/goodbye-london-colour-source.png`
- `goodbye-london/goodbye-london-black-white-derived.png`
- `war-inside/war-inside-colour-source.png`
- `war-inside/war-inside-black-white-derived.png`

## Run the upload
Run this from the repository root after extracting the ZIP locally. Use a private terminal and never paste the service-role key into chat, GitHub, or browser code.

```bash
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
SUPABASE_DOWNLOAD_BUCKET="YOUR_PRIVATE_BUCKET_NAME" \
node scripts/upload-artwork-to-supabase.mjs "/path/to/extracted/ART_TO_INK_customer_artwork_pack_compact"
```

On Windows PowerShell, set the variables in the current terminal first:

```powershell
$env:SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
$env:SUPABASE_DOWNLOAD_BUCKET="YOUR_PRIVATE_BUCKET_NAME"
node scripts/upload-artwork-to-supabase.mjs "C:\\path\\to\\extracted\\ART_TO_INK_customer_artwork_pack_compact"
```

The script stops before uploading if any expected image is missing, and reports each successful upload. It uses `upsert: true`, so rerunning it replaces files at the same object paths.

## After upload
1. Verify the bucket is private and all 16 objects are present.
2. Add/verify the Vercel production environment variables: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DOWNLOAD_BUCKET`, `NEXT_PUBLIC_SITE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, and `RESEND_FROM_EMAIL`.
3. Verify the `orders` table and required columns exist.
4. Add the matching object paths to `lib/secure-assets.ts` only after files exist. The checkout endpoint checks private storage before creating a Stripe session, so a missing object must never result in a payment.
5. Test with Stripe test mode and a Resend test recipient before enabling live payments.
6. Test both formats for each artwork, the seven-day download expiry, invalid tokens, duplicate webhook events, and owner notification. Do not claim the workflow is live until these pass.

## Current limitation
This script has been added to the repository, but the files have **not** been uploaded to Supabase by this commit. The connected Vercel project currently exposes no environment variables through the available project listing, so credentials and live integration still need to be configured/verified.
