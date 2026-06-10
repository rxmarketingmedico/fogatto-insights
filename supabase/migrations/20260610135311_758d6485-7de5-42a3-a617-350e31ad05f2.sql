-- 1. Criar schema interno para funções security definer não expostas via API
CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM public, anon, authenticated;
GRANT USAGE ON SCHEMA internal TO authenticated, service_role;

-- 2. Mover a função para o schema interno usando CASCADE para remover políticas dependentes
DROP FUNCTION IF EXISTS public.is_restaurant_owner(UUID) CASCADE;

CREATE OR REPLACE FUNCTION internal.is_restaurant_owner(_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants
    WHERE id = _restaurant_id AND owner_id = auth.uid()
  )
$$;

-- 3. Recriar as políticas RLS usando a nova função no schema internal
CREATE POLICY "Owners can manage their own menu items" ON public.menu_items
    FOR ALL TO authenticated USING (internal.is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can manage their own campaigns" ON public.campaigns
    FOR ALL TO authenticated USING (internal.is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can manage their own ad spend" ON public.ad_spend
    FOR ALL TO authenticated USING (internal.is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can view their own customers" ON public.customers
    FOR SELECT TO authenticated USING (internal.is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can view their own orders" ON public.orders
    FOR SELECT TO authenticated USING (internal.is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can view their own order items" ON public.order_items
    FOR SELECT TO authenticated USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_id AND internal.is_restaurant_owner(o.restaurant_id)
    ));
