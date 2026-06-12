import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { getOrders } from "@/lib/api/dashboard.functions";
import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/orders")({
  component: OrdersPage,
});

const PERIODS = [
  { label: "Hoje",    days: 0 },
  { label: "7 dias",  days: 7 },
  { label: "30 dias", days: 30 },
  { label: "Tudo",    days: -1 },
];

const STATUS_FILTERS = [
  { key: "all",      label: "Todos" },
  { key: "paid",     label: "Pagos" },
  { key: "queued",   label: "Pendentes" },
  { key: "canceled", label: "Cancelados" },
] as const;

type StatusKey = typeof STATUS_FILTERS[number]["key"];

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  paid:     { label: "Pago",      className: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400" },
  queued:   { label: "Pendente",  className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-950/40 dark:text-yellow-400" },
  canceled: { label: "Cancelado", className: "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400" },
};

const SOURCE_COLORS: Record<string, string> = {
  facebook:  "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  instagram: "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-400",
  google:    "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  direto:    "bg-muted text-muted-foreground",
};

function sourceColor(src: string | null) {
  return SOURCE_COLORS[src?.toLowerCase() ?? "direto"] ?? "bg-muted text-muted-foreground";
}

function OrdersPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchOrders = useServerFn(getOrders);

  const [periodDays, setPeriodDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState<StatusKey>("all");
  const [search, setSearch] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("all");

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  const from = useMemo(() => {
    if (periodDays === -1) return undefined;
    if (periodDays === 0)  return new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    return new Date(Date.now() - periodDays * 86400000).toISOString();
  }, [periodDays]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders", restaurant?.id, periodDays],
    queryFn: () => fetchOrders({ data: { restaurantId: restaurant!.id, from } }),
    enabled: !!restaurant,
  });

  // Unique campaigns present in this period (for filter dropdown)
  const campaigns = useMemo(() => {
    const set = new Set<string>();
    (orders ?? []).forEach(o => { if (o.utm_campaign) set.add(o.utm_campaign); });
    return Array.from(set).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (orders ?? []).filter(o => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (campaignFilter !== "all" && o.utm_campaign !== campaignFilter) return false;
      if (q) {
        const code  = (o.order_code ?? "").toLowerCase();
        const name  = ((o.customers as any)?.name ?? "").toLowerCase();
        const phone = ((o.customers as any)?.phone ?? "").toLowerCase();
        if (!code.includes(q) && !name.includes(q) && !phone.includes(q)) return false;
      }
      return true;
    });
  }, [orders, statusFilter, campaignFilter, search]);

  // KPIs from filtered list
  const kpis = useMemo(() => {
    const paid = filtered.filter(o => o.status === "paid");
    const revenue = paid.reduce((s, o) => s + Number(o.total), 0);
    return {
      total:   filtered.length,
      paid:    paid.length,
      revenue,
      avg:     paid.length > 0 ? revenue / paid.length : 0,
      pending: filtered.filter(o => o.status === "queued").length,
      canceled: filtered.filter(o => o.status === "canceled").length,
    };
  }, [filtered]);

  const hasFilters = statusFilter !== "all" || campaignFilter !== "all" || search.trim() !== "";

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isLoading ? "Carregando..." : `${kpis.total} pedido${kpis.total !== 1 ? "s" : ""} no período`}
          </p>
        </div>
        {/* Period tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 self-start sm:self-auto">
          {PERIODS.map(p => (
            <button
              key={p.days}
              onClick={() => setPeriodDays(p.days)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                periodDays === p.days
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard label="Pedidos" value={String(kpis.total)} />
        <KpiCard
          label="Receita paga"
          value={`R$ ${kpis.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          highlight
        />
        <KpiCard
          label="Ticket médio"
          value={`R$ ${kpis.avg.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
        />
        <div className="rounded-xl border bg-card p-4 shadow-sm space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</p>
          <div className="flex gap-2 flex-wrap mt-1">
            <span className="text-xs font-semibold text-green-600">{kpis.paid} pagos</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs font-semibold text-yellow-600">{kpis.pending} pend.</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs font-semibold text-red-500">{kpis.canceled} cancel.</span>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por código, cliente ou telefone…"
            className="w-full pl-8 pr-8 py-2 rounded-lg border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status buttons */}
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusFilter === f.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Campaign filter */}
        {campaigns.length > 0 && (
          <select
            value={campaignFilter}
            onChange={e => setCampaignFilter(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">Todas as campanhas</option>
            {campaigns.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={() => { setStatusFilter("all"); setCampaignFilter("all"); setSearch(""); }}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-lg border hover:bg-accent"
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Table */}
      <div className="border rounded-xl bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-3 text-left">Pedido</th>
              <th className="px-5 py-3 text-left">Cliente</th>
              <th className="px-5 py-3 text-left">Origem</th>
              <th className="px-5 py-3 text-left">Status</th>
              <th className="px-5 py-3 text-right">Total</th>
              <th className="px-5 py-3 text-right">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  Carregando pedidos...
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  {hasFilters
                    ? "Nenhum pedido encontrado com estes filtros."
                    : "Nenhum pedido no período selecionado."}
                </td>
              </tr>
            )}
            {filtered.map(o => {
              const customer = o.customers as any;
              const statusCfg = STATUS_CONFIG[o.status] ?? { label: o.status, className: "bg-muted text-muted-foreground" };
              const src = o.utm_source?.toLowerCase() ?? null;

              return (
                <tr key={o.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3">
                    <span className="font-mono text-xs font-semibold">#{o.order_code}</span>
                  </td>
                  <td className="px-5 py-3">
                    {customer?.name ? (
                      <div>
                        <p className="font-medium text-sm">{customer.name}</p>
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col gap-1">
                      <span className={`inline-flex w-fit px-2 py-0.5 rounded-full text-[11px] font-semibold ${sourceColor(src)}`}>
                        {o.utm_source || "direto"}
                      </span>
                      {o.utm_campaign && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={o.utm_campaign}>
                          {o.utm_campaign}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusCfg.className}`}>
                      {statusCfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-bold text-primary">
                    R$ {Number(o.total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(o.created_at).toLocaleDateString("pt-BR")}
                    <br />
                    <span className="text-[10px]">
                      {new Date(o.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`mt-1.5 text-xl font-bold tabular-nums ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}
