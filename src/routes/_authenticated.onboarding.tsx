import React, { useState, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRestaurant, updateRestaurant } from "@/lib/api/restaurant.functions";
import { getMetaAuthUrl } from "@/lib/api/meta-ads.functions";
import { FogattoFlame } from "@/components/FogattoLogo";
import { CheckCircle2, Facebook, ArrowRight, Utensils, Megaphone, BarChart3 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/onboarding")({
  component: OnboardingPage,
});

const STEPS = ["Seu restaurante", "Conectar Meta Ads", "Tudo pronto!"];

function OnboardingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRestaurant = useServerFn(getRestaurant);
  const saveRestaurant = useServerFn(updateRestaurant);
  const getMetaUrl = useServerFn(getMetaAuthUrl);

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", whatsapp: "", logo_url: "" });
  const [metaLoading, setMetaLoading] = useState(false);

  useEffect(() => {
    if (restaurant) {
      // Already onboarded — send to dashboard
      if (restaurant.whatsapp_number && restaurant.whatsapp_number !== "00000000000") {
        navigate({ to: "/app" });
        return;
      }
      setForm({
        name: restaurant.name || "",
        whatsapp: "",
        logo_url: restaurant.logo_url || "",
      });
    }
  }, [restaurant, navigate]);

  const saveMutation = useMutation({
    mutationFn: () =>
      saveRestaurant({
        data: {
          name: form.name,
          slug: restaurant!.slug,
          whatsapp_number: form.whatsapp.replace(/\D/g, ""),
          logo_url: form.logo_url || null,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["restaurant"] });
      setStep(1);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = form.whatsapp.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Digite um número de WhatsApp válido com DDD.");
      return;
    }
    saveMutation.mutate();
  };

  const handleConnectMeta = async () => {
    if (!restaurant) return;
    setMetaLoading(true);
    try {
      const { url } = await getMetaUrl({ data: { restaurantId: restaurant.id } });
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setMetaLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--color-background)" }}>
        <FogattoFlame width={40} />
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-background)",
        color: "var(--color-foreground)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px 16px",
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 40 }}>
        <FogattoFlame width={32} />
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 26, letterSpacing: "-0.03em" }}>
          Fogatto
        </span>
      </div>

      {/* Step indicator */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 40 }}>
        {STEPS.map((label, i) => (
          <React.Fragment key={i}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 13,
                  fontWeight: 700,
                  transition: "all 200ms ease",
                  background: i < step
                    ? "oklch(0.617 0.196 38.5)"
                    : i === step
                    ? "oklch(0.617 0.196 38.5)"
                    : "var(--color-muted)",
                  color: i <= step ? "oklch(0.072 0.008 55)" : "var(--color-muted-foreground)",
                  boxShadow: i === step ? "0 0 0 4px oklch(0.617 0.196 38.5 / 0.2)" : "none",
                }}
              >
                {i < step ? <CheckCircle2 size={16} /> : i + 1}
              </div>
              <span style={{ fontSize: 11, fontWeight: i === step ? 600 : 400, color: i === step ? "var(--color-foreground)" : "var(--color-muted-foreground)", whiteSpace: "nowrap" }}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 64, height: 2, margin: "0 8px", marginBottom: 22, background: i < step ? "oklch(0.617 0.196 38.5)" : "var(--color-border)", transition: "all 200ms ease" }} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Card */}
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "var(--color-card)",
          borderRadius: 20,
          padding: "36px 32px",
          boxShadow: "0 0 0 1px oklch(0.617 0.196 38.5 / 0.14), 0 24px 60px oklch(0 0 0 / 0.4)",
        }}
      >
        {step === 0 && <Step1 form={form} setForm={setForm} onSubmit={handleStep1} loading={saveMutation.isPending} />}
        {step === 1 && <Step2 restaurant={restaurant} onConnect={handleConnectMeta} metaLoading={metaLoading} onSkip={() => setStep(2)} />}
        {step === 2 && <Step3 navigate={navigate} />}
      </div>
    </div>
  );
}

// ─── Step 1: Restaurant basics ────────────────────────────────────────────────

function Step1({
  form,
  setForm,
  onSubmit,
  loading,
}: {
  form: { name: string; whatsapp: string; logo_url: string };
  setForm: React.Dispatch<React.SetStateAction<any>>;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
}) {
  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 6 }}>
          Vamos configurar seu restaurante
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>
          Essas informações aparecem no seu cardápio digital e nos pedidos recebidos.
        </p>
      </div>

      <OnboardingField label="Nome do restaurante">
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
          placeholder="Ex: Pizzaria do Vale"
        />
      </OnboardingField>

      <OnboardingField label="WhatsApp (com DDD)" hint="Usado para receber os pedidos">
        <input
          required
          type="tel"
          value={form.whatsapp}
          onChange={(e) => setForm((f: any) => ({ ...f, whatsapp: e.target.value }))}
          placeholder="(11) 99999-9999"
        />
      </OnboardingField>

      <OnboardingField label="Logo (URL da imagem)" hint="Opcional — aparece no cardápio e nos anúncios">
        <input
          type="url"
          value={form.logo_url}
          onChange={(e) => setForm((f: any) => ({ ...f, logo_url: e.target.value }))}
          placeholder="https://..."
        />
      </OnboardingField>

      <button
        type="submit"
        disabled={loading}
        style={{
          marginTop: 4,
          padding: "13px 0",
          borderRadius: 12,
          background: loading ? "oklch(0.617 0.196 38.5 / 0.5)" : "oklch(0.617 0.196 38.5)",
          color: "oklch(0.072 0.008 55)",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: 15,
          border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          width: "100%",
        }}
      >
        {loading ? "Salvando..." : <>Continuar <ArrowRight size={16} /></>}
      </button>
    </form>
  );
}

// ─── Step 2: Meta Ads connection ──────────────────────────────────────────────

function Step2({
  restaurant,
  onConnect,
  metaLoading,
  onSkip,
}: {
  restaurant: any;
  onConnect: () => void;
  metaLoading: boolean;
  onSkip: () => void;
}) {
  const isConnected = !!restaurant?.meta_ad_account_id;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, fontSize: 24, letterSpacing: "-0.02em", marginBottom: 6 }}>
          Conectar Meta Ads
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>
          Conecte sua conta para publicar campanhas e ver o ROAS direto no painel. Você pode pular e fazer isso depois nas configurações.
        </p>
      </div>

      {isConnected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12, background: "oklch(0.637 0.138 138.1 / 0.12)", border: "1px solid oklch(0.637 0.138 138.1 / 0.3)" }}>
          <CheckCircle2 size={20} style={{ color: "oklch(0.637 0.138 138.1)", flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600, fontSize: 14 }}>Meta Ads conectado!</p>
            <p style={{ fontSize: 12, color: "var(--color-muted-foreground)", marginTop: 2 }}>Conta: {restaurant.meta_ad_account_id}</p>
          </div>
        </div>
      ) : (
        <button
          onClick={onConnect}
          disabled={metaLoading}
          style={{
            padding: "13px 0",
            borderRadius: 12,
            background: "#1877F2",
            color: "#fff",
            fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
            fontWeight: 600,
            fontSize: 15,
            border: "none",
            cursor: metaLoading ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            opacity: metaLoading ? 0.6 : 1,
            width: "100%",
          }}
        >
          <Facebook size={18} />
          {metaLoading ? "Abrindo Meta..." : "Conectar com Facebook"}
        </button>
      )}

      <button
        onClick={onSkip}
        style={{
          padding: "11px 0",
          borderRadius: 12,
          background: "transparent",
          color: "var(--color-muted-foreground)",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          fontWeight: 500,
          fontSize: 14,
          border: "1px solid var(--color-border)",
          cursor: "pointer",
          width: "100%",
        }}
      >
        {isConnected ? "Continuar →" : "Pular por agora"}
      </button>
    </div>
  );
}

// ─── Step 3: Done! ────────────────────────────────────────────────────────────

function Step3({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, textAlign: "center" }}>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>
        <FogattoFlame width={56} />
      </div>
      <div>
        <h2 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 28, letterSpacing: "-0.03em", marginBottom: 8 }}>
          Tudo pronto!
        </h2>
        <p style={{ fontSize: 14, color: "var(--color-muted-foreground)", lineHeight: 1.6 }}>
          Seu restaurante está configurado. Agora você pode adicionar pratos ao cardápio e criar campanhas rastreadas.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
        <ActionButton
          icon={<Utensils size={18} />}
          label="Adicionar pratos ao cardápio"
          sub="Seus pratos viram anúncios com IA"
          onClick={() => navigate({ to: "/app/menu" })}
          primary
        />
        <ActionButton
          icon={<Megaphone size={18} />}
          label="Criar primeira campanha"
          sub="Publique no Meta Ads em minutos"
          onClick={() => navigate({ to: "/app/campaigns" })}
        />
        <ActionButton
          icon={<BarChart3 size={18} />}
          label="Ver dashboard"
          sub="Acompanhe pedidos e ROAS"
          onClick={() => navigate({ to: "/app" })}
        />
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function OnboardingField({ label, hint, children }: { label: string; hint?: string; children: React.ReactElement<React.InputHTMLAttributes<HTMLInputElement>> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>{label}</label>
        {hint && <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>{hint}</span>}
      </div>
      {React.cloneElement(children, {
        style: {
          width: "100%",
          padding: "11px 14px",
          borderRadius: 10,
          background: "var(--color-input)",
          border: "1px solid var(--color-border)",
          color: "var(--color-foreground)",
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          fontSize: 14,
          outline: "none",
          boxSizing: "border-box",
        } as React.CSSProperties,
      })}
    </div>
  );
}

function ActionButton({ icon, label, sub, onClick, primary }: { icon: React.ReactNode; label: string; sub: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "14px 16px",
        borderRadius: 12,
        border: primary ? "none" : "1px solid var(--color-border)",
        background: primary ? "oklch(0.617 0.196 38.5)" : "transparent",
        color: primary ? "oklch(0.072 0.008 55)" : "var(--color-foreground)",
        cursor: "pointer",
        textAlign: "left",
        width: "100%",
        transition: "all 140ms ease",
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
      }}
    >
      <div style={{
        width: 38,
        height: 38,
        borderRadius: 10,
        background: primary ? "oklch(0 0 0 / 0.12)" : "var(--color-muted)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{sub}</div>
      </div>
      <ArrowRight size={16} style={{ marginLeft: "auto", opacity: 0.5 }} />
    </button>
  );
}
