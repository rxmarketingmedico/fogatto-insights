-- 1. Revogar execução pública de funções SECURITY DEFINER
REVOKE EXECUTE ON FUNCTION public.is_restaurant_owner(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_restaurant_owner(UUID) TO authenticated, service_role;

-- 2. Corrigir permissões excessivas (Remover INSERT via PostgREST anon)
-- O checkout será feito via TanStack server functions para garantir integridade e atribuição.
REVOKE INSERT ON public.customers FROM anon;
REVOKE INSERT ON public.orders FROM anon;
REVOKE INSERT ON public.order_items FROM anon;

-- 3. Ajustar políticas RLS (remover CHECK(true))
DROP POLICY "Anyone can create customer profile via checkout" ON public.customers;
CREATE POLICY "Service role can manage customers" ON public.customers
    FOR ALL TO service_role USING (true);

DROP POLICY "Anyone can create order via checkout" ON public.orders;
CREATE POLICY "Service role can manage orders" ON public.orders
    FOR ALL TO service_role USING (true);

DROP POLICY "Anyone can create order items via checkout" ON public.order_items;
CREATE POLICY "Service role can manage order items" ON public.order_items
    FOR ALL TO service_role USING (true);
