import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { getDashboardStats } from "@/lib/api/dashboard.functions";
import { useEffect, useState } from "react";
import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardIndex,
});

const PERIODS = [
  { label: "Hoje", days: 0 },
  { label: "7 dias", days: 7 },
  { label: "30 dias", days: 30 },
  { label: "90 dias", days: 90 },
];

function DashboardIndex() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchStats = useServerFn(getDashboardStats);
  const navigate = useNavigate();
  const [periodDays, setPeriodDays] = useState(30);

  const { data: restaurant, isLoading: loadingRestaurant } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  useEffect(() => {
    if (!loadingRestaurant && !restaurant) {
      navigate({ to: "/app/settings" });
    }
  }, [restaurant, loadingRestaurant, navigate]);

  const from = periodDays === 0
    ? new Date(new Date().setHours(0, 0, 0, 0)).toISOString()
    : new Date(Date.now() - periodDays * 86400000).toISOString();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard-stats", restaurant?.id, periodDays],
    queryFn: () => fetchStats({ data: { restaurantId: restaurant!.id, from } }),
    enabled: !!restaurant,
  });

  // Attribution breakdown from raw orders
  const bySource = (stats?.orders ?? []).reduce<Record<string, { orders: number; revenue: number }>>((acc, o) => {
    const key = [o.utm_source || "direto", o.utm_campaign || "-"].join(" / ");
    if (!acc[key]) acc[key] = { orders: 0, revenue: 0 };
    acc[key].orders += 1;
    acc[key].revenue += Number(o.total);
    return acc;
  }, {});

  const topSources = Object.entries(bySource)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 8);

  if (loadingRestaurant) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!restaurant) return null;

  const menuUrl = `${window.location.origin}/r/${restaurant.slug}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(menuUrl);
    toast.success("Link copiado!");
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{restaurant.name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Visão geral do seu negócio</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriodDays(p.days)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                periodDays === p.days ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Receita"
          value={loadingStats ? "..." : `R$ ${(stats?.totalRevenue ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          sub={PERIODS.find(p => p.days === periodDays)?.label}
        />
        <StatCard
          title="Pedidos"
          value={loadingStats ? "..." : String(stats?.totalOrders ?? 0)}
          sub={PERIODS.find(p => p.days === periodDays)?.label}
        />
        <StatCard
          title="Ticket Médio"
          value={loadingStats ? "..." : `R$ ${(stats?.avgTicket ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <StatCard
          title="Clientes Únicos"
          value={loadingStats ? "..." : String(stats?.totalCustomers ?? 0)}
          sub="total acumulado"
        />
      </div>

      {/* Attribution breakdown */}
      {topSources.length > 0 && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-semibold">Receita por origem</h2>
            <p className="text-xs text-muted-foreground mt-0.5">utm_source / utm_campaign</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-6 py-3 text-left">Origem</th>
                <th className="px-6 py-3 text-right">Pedidos</th>
                <th className="px-6 py-3 text-right">Receita</th>
                <th className="px-6 py-3 text-right">% do total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {topSources.map(([key, val]) => (
                <tr key={key} className="hover:bg-accent/40">
                  <td className="px-6 py-3 font-medium">{key}</td>
                  <td className="px-6 py-3 text-right tabular-nums">{val.orders}</td>
                  <td className="px-6 py-3 text-right tabular-nums font-semibold text-primary">
                    R$ {val.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums text-muted-foreground">
                    {stats?.totalRevenue ? ((val.revenue / stats.totalRevenue) * 100).toFixed(1) : "0"}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Menu link */}
      <div className="rounded-xl border bg-card p-5">
        <p className="text-sm font-medium mb-2">Link do seu cardápio</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm truncate">{menuUrl}</code>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
          >
            <Copy size={14} /> Copiar
          </button>
          <a
            href={menuUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-medium hover:bg-accent transition-colors"
          >
            <ExternalLink size={14} /> Abrir
          </a>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}
