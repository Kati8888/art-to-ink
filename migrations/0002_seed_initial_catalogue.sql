-- Initial catalogue publication for the eight established secure-download product slugs.
-- All prices are EUR and stored in minor units. R2 objects must exist before a variant can be purchased.
INSERT OR IGNORE INTO products (slug, title, active) VALUES
  ('sea-dragons', 'Assimilation — Seahorses', 1),
  ('brain-heart', 'Brain Heart', 1),
  ('faces-within', 'Aura of Pete', 1),
  ('goodbye-london', 'Good Bye, London', 1),
  ('lion-heart', 'Lion Heart', 1),
  ('mrs-beer', 'MRS Beer', 1),
  ('war-inside', 'War Inside', 1),
  ('babicka-dedo', 'Grandma & Grandpa', 1);

-- Values follow the existing storefront catalogue: €9 / €19 / €39 / €79 / €149.
-- The final collection package stays unavailable until its ZIP is actually uploaded to R2.
WITH sizes(variant_key, price_minor) AS (
  VALUES ('mini', 900), ('small', 1900), ('detailed', 3900), ('premium', 7900), ('collection', 14900)
),
formats(artwork_format, suffix) AS (
  VALUES ('colour', 'colour'), ('blackAndWhite', 'blackAndWhite')
),
products_to_publish(slug) AS (
  VALUES ('sea-dragons'), ('brain-heart'), ('faces-within'), ('goodbye-london'),
         ('lion-heart'), ('mrs-beer'), ('war-inside'), ('babicka-dedo')
)
INSERT OR IGNORE INTO product_variants
  (id, product_slug, variant_key, artwork_format, price_minor, currency, r2_object_key, active)
SELECT
  p.slug || '-' || s.variant_key || '-' || f.suffix,
  p.slug,
  s.variant_key,
  f.artwork_format,
  s.price_minor,
  'eur',
  p.slug || '/' || p.slug || '-' || f.suffix ||
    CASE s.variant_key
      WHEN 'mini' THEN '-1200.png'
      WHEN 'small' THEN '-2000.png'
      WHEN 'detailed' THEN '-3200.png'
      WHEN 'premium' THEN '-4000.png'
      WHEN 'collection' THEN '-complete-collection.zip'
    END,
  1
FROM products_to_publish p
CROSS JOIN sizes s
CROSS JOIN formats f;
