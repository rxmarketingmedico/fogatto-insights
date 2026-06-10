import React, { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { FogattoLogo } from "@/components/FogattoLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [{ title: "Entrar — Fogatto" }],
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
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              restaurant_name: restaurantName,
              restaurant_slug: slug,
            },
          },
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: dbError } = await supabase.from("restaurants").insert({
            owner_id: authData.user.id,
            name: restaurantName,
            slug: slug,
            whatsapp_number: "00000000000",
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
    <div
      className="flex min-h-screen items-center justify-center p-4"
      style={{
        background:
          "radial-gradient(58% 48% at 50% 40%, oklch(0.617 0.196 38.5 / 0.18), transparent 68%), oklch(0.072 0.008 55)",
      }}
    >
      {/* Card */}
      <div
        className="w-full max-w-sm"
        style={{
          background: "oklch(0.12 0.012 48)",
          borderRadius: 20,
          boxShadow: "0 0 0 1px oklch(0.617 0.196 38.5 / 0.18), 0 32px 80px oklch(0 0 0 / 0.6)",
          padding: "40px 36px",
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <FogattoLogo variant="stacked" size="lg" />
          <p
            style={{
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontSize: 14,
              color: "oklch(0.642 0.021 77.8)",
              marginTop: 4,
            }}
          >
            {mode === "login" ? "Entre na sua conta" : "Crie sua conta agora"}
          </p>
        </div>

        <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {mode === "signup" && (
            <Field label="Nome do restaurante">
              <input
                type="text"
                required
                placeholder="Ex: Pizzaria do Vale"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
              />
            </Field>
          )}
          <Field label="Email">
            <input
              type="email"
              required
              placeholder="voce@restaurante.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Senha">
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 8,
              padding: "12px 0",
              borderRadius: 12,
              background: loading
                ? "oklch(0.617 0.196 38.5 / 0.5)"
                : "oklch(0.617 0.196 38.5)",
              color: "oklch(0.072 0.008 55)",
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontWeight: 600,
              fontSize: 15,
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
              transition: "all 140ms ease",
              width: "100%",
            }}
          >
            {loading ? "Processando..." : mode === "login" ? "Entrar" : "Cadastrar"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontSize: 13,
              color: "oklch(0.617 0.196 38.5)",
            }}
          >
            {mode === "login"
              ? "Não tem uma conta? Cadastre-se"
              : "Já tem uma conta? Entre"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>>;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label
        style={{
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: "oklch(0.792 0.017 78.2)",
          letterSpacing: "0.02em",
        }}
      >
        {label}
      </label>
      {React.cloneElement(children, {
        style: {
          width: "100%",
          padding: "10px 14px",
          borderRadius: 10,
          background: "oklch(0.148 0.016 47)",
          border: "1px solid oklch(0.617 0.196 38.5 / 0.2)",
          color: "oklch(0.963 0.009 88.3)",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        } as React.CSSProperties,
      })}
    </div>
  );
}

