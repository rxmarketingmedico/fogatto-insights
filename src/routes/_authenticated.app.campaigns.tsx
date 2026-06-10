import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import {
  getCampaigns,
  upsertCampaign,
  getAdSpend,
  upsertAdSpend,
  deleteAdSpend,
  getCampaignRoas,
} from "@/lib/api/dashboard.functions";
import { useState } from "react";
import { Plus, Trash2, TrendingUp, DollarSign } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/campaigns")({
  component: CampaignsPage,
});

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  outro: "Outro",
};

function CampaignsPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchCampaigns = useServerFn(getCampaigns);
  const fetchRoas = useServerFn(getCampaignRoas);
  const fetchSpend = useServerFn(getAdSpend);
  const saveCampaign = useServerFn(upsertCampaign);
  const saveSpend = useServerFn(upsertAdSpend);
  const removeSpend = useServerFn(deleteAdSpend);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"roas" | "spend">("roas");
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState({ name: "", platform: "meta", utm_campaign: "" });
  const [spendForm, setSpendForm] = useState({ campaign_id: "", date: new Date().toISOString().slice(0, 10), amount: "" });

  const { data: restaurant } = useQuery({ queryKey: ["restaurant"], queryFn: () => fetchRestaurant() });

  const { data: roas, isLoading: loadingRoas } = useQuery({
    queryKey: ["campaign-roas", restaurant?.id],
    queryFn: () => fetchRoas({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant,
  });

  const { data: campaigns } = useQuery({
    queryKey: ["campaigns", restaurant?.id],
    queryFn: () => fetchCampaigns({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant,
  });

  const { data: spends, isLoading: loadingSpend } = useQuery({
    queryKey: ["ad-spend", restaurant?.id],
    queryFn: () => fetchSpend({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant,
  });

  const campaignMutation = useMutation({
    mutationFn: (data: any) => saveCampaign({ data: { ...data, restaurant_id: restaurant!.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      setShowCampaignForm(false);
      setCampaignForm({ name: "", platform: "meta", utm_campaign: "" });
      toast.success("Campanha salva!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const spendMutation = useMutation({
    mutationFn: (data: any) => saveSpend({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      setShowSpendForm(false);
      setSpendForm({ campaign_id: "", date: new Date().toISOString().slice(0, 10), amount: "" });
      toast.success("Gasto registrado!");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeSpend({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
      queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      toast.success("Lançamento removido.");
    },
  });

  const roasColor = (v: number | null) => {
    if (v === null) return "text-muted-foreground";
    if (v >= 3) return "text-green-600 font-bold";
    if (v >= 1) return "text-yellow-600 font-semibold";
    return "text-red-500 font-semibold";
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Campanhas</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowSpendForm(true)}
            className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <DollarSign size={16} /> Lançar gasto
          </button>
          <button
            onClick={() => setShowCampaignForm(true)}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-3 py-2 rounded-lg text-sm font-medium hover:opacity-90"
          >
            <Plus size={16} /> Nova campanha
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(["roas", "spend"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "roas" ? "ROAS por campanha" : "Histórico de gastos"}
          </button>
        ))}
      </div>

      {/* ROAS Table */}
      {tab === "roas" && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Campanha</th>
                <th className="px-5 py-3 text-left">Plataforma</th>
                <th className="px-5 py-3 text-right">Gasto</th>
                <th className="px-5 py-3 text-right">Receita atribuída</th>
                <th className="px-5 py-3 text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingRoas && (
                <tr><td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!loadingRoas && roas?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhuma campanha ainda. Crie uma e lance o gasto para ver o ROAS.
                  </td>
                </tr>
              )}
              {roas?.map(c => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">utm_campaign={c.utm_campaign}</p>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{PLATFORM_LABELS[c.platform] ?? c.platform}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {c.spend > 0 ? `R$ ${c.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-primary font-semibold">
                    {c.revenue > 0 ? `R$ ${c.revenue.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : <span className="font-normal text-muted-foreground">—</span>}
                  </td>
                  <td className={`px-5 py-3 text-right tabular-nums ${roasColor(c.roas)}`}>
                    {c.roas !== null ? `${c.roas.toFixed(2)}x` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Spend History */}
      {tab === "spend" && (
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Campanha</th>
                <th className="px-5 py-3 text-left">Data</th>
                <th className="px-5 py-3 text-right">Valor</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingSpend && (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!loadingSpend && spends?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhum gasto lançado ainda.
                  </td>
                </tr>
              )}
              {spends?.map(s => (
                <tr key={s.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium">{(s as any).campaigns?.name ?? "—"}</td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(s.date + "T12:00:00").toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">
                    R$ {Number(s.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => { if (confirm("Remover este lançamento?")) deleteMutation.mutate(s.id); }}
                      className="p-1.5 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Campaign Form Modal */}
      {showCampaignForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={e => { e.preventDefault(); campaignMutation.mutate(campaignForm); }}
            className="bg-card border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
          >
            <h3 className="font-bold text-lg">Nova Campanha</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Nome</label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={campaignForm.name}
                onChange={e => setCampaignForm({ ...campaignForm, name: e.target.value })}
                placeholder="Ex: Remarketing Setembro"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Plataforma</label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={campaignForm.platform}
                onChange={e => setCampaignForm({ ...campaignForm, platform: e.target.value })}
              >
                <option value="meta">Meta Ads</option>
                <option value="google">Google Ads</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">utm_campaign</label>
              <input
                className="w-full border rounded-md px-3 py-2 bg-background text-sm font-mono"
                value={campaignForm.utm_campaign}
                onChange={e => setCampaignForm({ ...campaignForm, utm_campaign: e.target.value })}
                placeholder="ex: remarketing-set24"
                required
              />
              <p className="text-xs text-muted-foreground">Deve ser idêntico ao valor na URL do anúncio</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCampaignForm(false)} className="px-4 py-2 text-sm rounded-md hover:bg-accent">Cancelar</button>
              <button disabled={campaignMutation.isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
                {campaignMutation.isPending ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Spend Form Modal */}
      {showSpendForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={e => {
              e.preventDefault();
              spendMutation.mutate({
                restaurant_id: restaurant!.id,
                campaign_id: spendForm.campaign_id,
                date: spendForm.date,
                amount: parseFloat(spendForm.amount),
              });
            }}
            className="bg-card border rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4"
          >
            <h3 className="font-bold text-lg">Lançar Gasto</h3>
            <div className="space-y-1">
              <label className="text-sm font-medium">Campanha</label>
              <select
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={spendForm.campaign_id}
                onChange={e => setSpendForm({ ...spendForm, campaign_id: e.target.value })}
                required
              >
                <option value="">Selecione...</option>
                {campaigns?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Data</label>
              <input
                type="date"
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={spendForm.date}
                onChange={e => setSpendForm({ ...spendForm, date: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Valor (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                value={spendForm.amount}
                onChange={e => setSpendForm({ ...spendForm, amount: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowSpendForm(false)} className="px-4 py-2 text-sm rounded-md hover:bg-accent">Cancelar</button>
              <button disabled={spendMutation.isPending} className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:opacity-90 disabled:opacity-50">
                {spendMutation.isPending ? "Salvando..." : "Registrar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
