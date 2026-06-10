-- Move sensitive Meta access token to a dedicated secrets table accessible only via service_role.
CREATE TABLE IF NOT EXISTS public.restaurant_secrets (
  restaurant_id uuid PRIMARY KEY REFERENCES public.restaurants(id) ON DELETE CASCADE,
  meta_access_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.restaurant_secrets (restaurant_id, meta_access_token)
SELECT id, meta_access_token
FROM public.restaurants
WHERE meta_access_token IS NOT NULL
ON CONFLICT (restaurant_id) DO UPDATE
  SET meta_access_token = EXCLUDED.meta_access_token,
      updated_at = now();

GRANT ALL ON public.restaurant_secrets TO service_role;

ALTER TABLE public.restaurant_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages restaurant secrets"
  ON public.restaurant_secrets
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

ALTER TABLE public.restaurants DROP COLUMN IF EXISTS meta_access_token;

-- Restrict anonymous SELECT on menu_items to non-sensitive columns only
-- (anonymous menu viewers should never see internal restaurant_id UUIDs).
REVOKE SELECT ON public.menu_items FROM anon;
GRANT SELECT (id, name, description, price, photo_url, position, active, created_at, updated_at)
  ON public.menu_items TO anon;