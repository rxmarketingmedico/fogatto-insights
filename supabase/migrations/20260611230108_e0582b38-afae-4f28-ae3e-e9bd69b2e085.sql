-- Inserir restaurantes de teste com slugs únicos e o owner_id correto
DO $$
DECLARE
    admin_id UUID;
    rest1_id UUID := gen_random_uuid();
    rest2_id UUID := gen_random_uuid();
    camp1_id UUID := gen_random_uuid();
    camp2_id UUID := gen_random_uuid();
    camp3_id UUID := gen_random_uuid();
    cust1_id UUID := gen_random_uuid();
    cust2_id UUID := gen_random_uuid();
    cust3_id UUID := gen_random_uuid();
    cust4_id UUID := gen_random_uuid();
BEGIN
    -- Pegar o primeiro usuário disponível como admin
    SELECT id INTO admin_id FROM auth.users LIMIT 1;

    -- Inserir restaurantes
    INSERT INTO public.restaurants (id, name, slug, owner_id, whatsapp_number)
    VALUES 
      (rest1_id, 'Burguer Tech Test', 'burguer-tech-test-' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)), admin_id, '11999999999'),
      (rest2_id, 'Pizza Master Test', 'pizza-master-test-' || lower(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6)), admin_id, '11888888888');

    -- Campanhas
    INSERT INTO public.campaigns (id, restaurant_id, name, platform, utm_campaign, status)
    VALUES
      (camp1_id, rest1_id, 'Meta - Promo Burguer 2x1', 'meta', 'promo_burguer_2x1', 'active'),
      (camp2_id, rest1_id, 'Meta - Remarketing Carrinho', 'meta', 'remarketing_carrinho', 'active'),
      (camp3_id, rest2_id, 'Meta - Pizza Weekend', 'meta', 'pizza_weekend', 'active');

    -- Gastos
    INSERT INTO public.ad_spend (restaurant_id, campaign_id, amount, date, source)
    VALUES
      (rest1_id, camp1_id, 150.00, CURRENT_DATE - INTERVAL '1 day', 'meta'),
      (rest1_id, camp2_id, 50.00, CURRENT_DATE - INTERVAL '1 day', 'meta'),
      (rest2_id, camp3_id, 100.00, CURRENT_DATE - INTERVAL '1 day', 'meta');

    -- Clientes
    INSERT INTO public.customers (id, restaurant_id, name, phone, first_utm_source, first_utm_campaign, first_seen_at)
    VALUES
      (cust1_id, rest1_id, 'João Silva Test', '11912345678', 'facebook', 'promo_burguer_2x1', NOW() - INTERVAL '2 days'),
      (cust2_id, rest1_id, 'Maria Souza Test', '11987654321', 'instagram', 'remarketing_carrinho', NOW() - INTERVAL '1 day'),
      (cust3_id, rest1_id, 'Pedro Santos Test', '11955554444', NULL, NULL, NOW() - INTERVAL '3 hours'),
      (cust4_id, rest2_id, 'Ana Oliveira Test', '11900001111', 'facebook', 'pizza_weekend', NOW() - INTERVAL '5 hours');

    -- Pedidos
    INSERT INTO public.orders (restaurant_id, customer_id, total, status, order_code, utm_source, utm_campaign, fbclid, first_touch_at, created_at)
    VALUES
      (rest1_id, cust1_id, 85.50, 'paid', 'BTT01', 'facebook', 'promo_burguer_2x1', 'fb_123456', NOW() - INTERVAL '2 days', NOW() - INTERVAL '1 day'),
      (rest1_id, cust1_id, 45.00, 'queued', 'BTT02', 'facebook', 'promo_burguer_2x1', 'fb_123456', NOW() - INTERVAL '2 days', NOW() - INTERVAL '12 hours'),
      (rest1_id, cust2_id, 120.00, 'canceled', 'BTT03', 'instagram', 'remarketing_carrinho', 'fb_789012', NOW() - INTERVAL '1 day', NOW() - INTERVAL '6 hours'),
      (rest1_id, cust3_id, 55.90, 'paid', 'BTT04', NULL, NULL, NULL, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours'),
      (rest2_id, cust4_id, 95.00, 'paid', 'PMT01', 'facebook', 'pizza_weekend', 'fb_abc123', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours');
END $$;