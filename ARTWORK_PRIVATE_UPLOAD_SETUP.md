# ART TO INK — private artwork upload

The live Supabase project already has a private Storage bucket named `art-to-ink-originals`. It currently contains no artwork objects. Checkout therefore remains disabled until the verified source artwork is uploaded.

## Before uploading
1. Apply the reviewed commerce migration to the existing Supabase project.
2. Confirm the bucket `art-to-ink-originals` remains private.
3. Obtain the original artwork pack containing these 16 PNG files:
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

## Upload and register the files
Run this from a private local terminal. Never paste the Supabase service-role key into ChatGPT, GitHub, browser code, or a public repository.

```bash
SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY" \
SUPABASE_DOWNLOAD_BUCKET="art-to-ink-originals" \
pnpm commerce:upload-assets "/path/to/extracted/artwork-pack"
```

The script verifies the bucket is private and checks all 16 source files before it starts. It creates four longest-edge sizes (1,200 / 2,000 / 3,200 / 4,000 px) for each artwork and both formats, builds a ZIP containing the four sizes for each format, uploads the 80 resulting objects, and registers each one in `commerce_assets`.

The upload uses `upsert: true`; running it again replaces files at the same object paths. Inspect the source files and output paths first.

## After upload
1. Confirm the Storage bucket is still private.
2. Confirm the generated assets are registered in `public.commerce_assets`.
3. Test checkout with Stripe test mode.
4. Test one-time annual licence purchase, verified email account claim, licence activation, download expiry, and full/partial refunds.
5. Do not enable live sales until the Vercel production environment variables and Brevo sender verification are confirmed.

## Important
- The grayscale files are derived grayscale versions, not manually redrawn tattoo stencils.
- The upload script does not change public gallery preview images.
- No original artwork files are currently in the live private bucket.
