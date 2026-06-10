ALTER TABLE public.ad_spend
ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS meta_impressions bigint,
ADD COLUMN IF NOT EXISTS meta_clicks bigint,
ADD COLUMN IF NOT EXISTS meta_reach bigint,
ADD COLUMN IF NOT EXISTS meta_last_synced_at timestamptz;
