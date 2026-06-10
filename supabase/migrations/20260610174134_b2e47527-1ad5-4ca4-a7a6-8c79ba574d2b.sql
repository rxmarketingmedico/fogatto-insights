ALTER TABLE public.restaurants 
ADD COLUMN IF NOT EXISTS meta_access_token text,
ADD COLUMN IF NOT EXISTS meta_ad_account_id text,
ADD COLUMN IF NOT EXISTS meta_page_id text,
ADD COLUMN IF NOT EXISTS meta_connected_at timestamptz;

ALTER TABLE public.campaigns
ADD COLUMN IF NOT EXISTS meta_campaign_id text,
ADD COLUMN IF NOT EXISTS meta_adset_id text,
ADD COLUMN IF NOT EXISTS meta_ad_id text,
ADD COLUMN IF NOT EXISTS meta_status text,
ADD COLUMN IF NOT EXISTS meta_published_at timestamptz;