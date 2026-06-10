-- Função para criar restaurante automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user_restaurant()
RETURNS TRIGGER AS $$
DECLARE
    restaurant_name TEXT;
    restaurant_slug TEXT;
BEGIN
    -- Tenta pegar os metadados enviados no signup
    restaurant_name := COALESCE(NEW.raw_user_meta_data->>'restaurant_name', 'Meu Restaurante');
    restaurant_slug := COALESCE(NEW.raw_user_meta_data->>'restaurant_slug', 'restaurante-' || substr(NEW.id::text, 1, 8));

    INSERT INTO public.restaurants (owner_id, name, slug, whatsapp_number)
    VALUES (NEW.id, restaurant_name, restaurant_slug, '00000000000');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger no auth.users (precisa ser feito no esquema auth ou via evento)
-- Como não podemos criar triggers diretamente no esquema 'auth' via migration padrão em alguns ambientes,
-- vamos garantir que a função exista e possa ser chamada, ou usar um mecanismo de reconciliação.
-- No Lovable Cloud, podemos usar um trigger em auth.users.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_restaurant();