-- iFood bridge: store restaurant's iFood URL
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS ifood_url text;

-- Click tracking table for bridge links
CREATE TABLE IF NOT EXISTS public.link_clicks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  campaign_id  uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  destination  text NOT NULL DEFAULT 'menu', -- 'menu' | 'ifood'
  utm_source   text,
  utm_campaign text,
  utm_medium   text,
  user_agent   text,
  clicked_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.link_clicks TO public;
GRANT ALL ON public.link_clicks TO authenticated;
GRANT ALL ON public.link_clicks TO service_role;

-- Index for fast per-campaign lookup
CREATE INDEX IF NOT EXISTS link_clicks_campaign_id_idx ON public.link_clicks (campaign_id);
CREATE INDEX IF NOT EXISTS link_clicks_restaurant_id_idx ON public.link_clicks (restaurant_id);

-- RLS
ALTER TABLE public.link_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a click (anonymous visitors clicking ads)
CREATE POLICY "Public can insert link clicks"
  ON public.link_clicks FOR INSERT TO public
  WITH CHECK (true);

-- Only the restaurant owner can read their own clicks
CREATE POLICY "Restaurant owner can read own clicks"
  ON public.link_clicks FOR SELECT TO authenticated
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
  );