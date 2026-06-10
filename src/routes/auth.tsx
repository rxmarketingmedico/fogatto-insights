import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar — Fogatto" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const navigate = useNavigate();

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const slug = restaurantName
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const { data: authData, error: authError } = await supabase.auth.signUp({ 
          email, 
          password,
          options: {
            data: {
              restaurant_name: restaurantName,
              restaurant_slug: slug
            }
          }
        });
        
        if (authError) throw authError;

        if (authData.user) {
          // If auto-confirm is enabled, we might already have a session
          // But usually we need to wait for email confirmation or it might auto-login in some configs
          const { error: dbError } = await supabase.from("restaurants").insert({
            owner_id: authData.user.id,
            name: restaurantName,
            slug: slug,
            whatsapp_number: "00000000000" // Placeholder to be updated in onboarding
          });
          
          if (dbError) console.error("Error creating restaurant:", dbError);
        }

        alert("Conta criada! Verifique seu email para confirmar e acessar seu painel.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/app" });
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl border bg-card p-8 shadow-lg">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight"> Fogatto</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta agora"}
          </p>
        </div>
        <form onSubmit={handleAuth} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="block text-sm font-medium">Nome do Restaurante</label>
              <input
                type="text"
                required
                placeholder="Ex: Pizzaria do Vale"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium">Email</label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Senha</label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-md border bg-background px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            disabled={loading}
            className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Processando..." : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>
        <div className="text-center">
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-sm text-primary hover:underline"
          >
            {mode === "login" ? "Não tem uma conta? Cadastre-se" : "Já tem uma conta? Entre"}
          </button>
        </div>
      </div>
    </div>
  );
}
