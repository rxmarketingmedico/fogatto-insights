DROP POLICY IF EXISTS "Anyone can view restaurant profile by slug" ON public.restaurants;
REVOKE SELECT ON public.restaurants FROM anon;