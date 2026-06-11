import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { useEffect } from "react";
import { FogattoFlame } from "@/components/FogattoLogo";
import { z } from "zod";

// Server function: log click, return iFood URL
const trackClick = createServerFn({ method: "POST" })
  .inputValidator((data: any) =>
    z.object({
      slug: z.string(),
      campaign_id: z.string().nullable().optional(),
      utm_source: z.string().nullable().optional(),
      utm_campaign: z.string().nullable().optional(),
      utm_medium: z.string().nullable().optional(),
      user_agent: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("id, ifood_url")
      .eq("slug", data.slug)
      .maybeSingle();

    if (!restaurant?.ifood_url) return { url: null };

    // Log click — best-effort
    try {
      await supabase.from("link_clicks").insert({
        restaurant_id: restaurant.id,
        campaign_id: data.campaign_id || null,
        destination: "ifood",
        utm_source: data.utm_source || null,
        utm_campaign: data.utm_campaign || null,
        utm_medium: data.utm_medium || null,
        user_agent: (data.user_agent ?? "").slice(0, 500),
      });
    } catch (_) {}

    return { url: restaurant.ifood_url };
  });

export const Route = createFileRoute("/go/$slug")({
  component: BridgePage,
});

function BridgePage() {
  const { slug } = Route.useParams();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    trackClick({
      data: {
        slug,
        campaign_id: params.get("cid"),
        utm_source: params.get("utm_source"),
        utm_campaign: params.get("utm_campaign"),
        utm_medium: params.get("utm_medium"),
        user_agent: navigator.userAgent,
      },
    }).then((result) => {
      if (result?.url) {
        window.location.replace(result.url);
      }
    });
  }, [slug]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--color-background)",
        flexDirection: "column",
        gap: 16,
      }}
    >
      <FogattoFlame width={40} />
      <p
        style={{
          fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
          fontSize: 14,
          color: "var(--color-muted-foreground)",
        }}
      >
        Redirecionando…
      </p>
    </div>
  );
}
