-- Ajusta a função para ser segura
ALTER FUNCTION public.handle_new_user_restaurant() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_restaurant() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_restaurant() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_restaurant() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user_restaurant() TO service_role;