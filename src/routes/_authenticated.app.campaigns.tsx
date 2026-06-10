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
import { publishMetaAd, searchMetaLocations, syncMetaInsights, updateMetaCampaignStatus } from "@/lib/api/meta-ads.functions";
import { useState, useRef } from "react";
import {
  Plus,
  Trash2,
  DollarSign,
  Facebook,
  ExternalLink,
  Calendar,
  Eye,
  ShoppingCart,
  Users,
  MapPin,
  Search,
  ChevronRight,
  ChevronLeft,
  X,
  RefreshCw,
  MousePointerClick,
  Layers,
  Play,
  Pause,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/campaigns")({
  component: CampaignsPage,
});

const PLATFORM_LABELS: Record<string, string> = {
  meta: "Meta Ads",
  google: "Google Ads",
  outro: "Outro",
};

const OBJECTIVES = [
  {
    id: "OUTCOME_TRAFFIC" as const,
    icon: Users,
    label: "Atrair clientes",
    desc: "Leva pessoas ao seu cardápio online",
  },
  {
    id: "OUTCOME_SALES" as const,
    icon: ShoppingCart,
    label: "Gerar pedidos",
    desc: "Otimizado para conversão direta",
  },
  {
    id: "OUTCOME_AWARENESS" as const,
    icon: Eye,
    label: "Aumentar visibilidade",
    desc: "Maximiza o alcance da sua marca",
  },
];

const STEP_LABELS = ["Objetivo", "Público", "Orçamento", "Criativo"];

type Objective = "OUTCOME_TRAFFIC" | "OUTCOME_SALES" | "OUTCOME_AWARENESS";
type BudgetType = "daily" | "lifetime";
type Gender = "all" | "male" | "female";

interface WizardState {
  objective: Objective;
  ageMin: number;
  ageMax: number;
  gender: Gender;
  locationSearch: string;
  locationKey: string;
  locationName: string;
  locationRadius: number;
  budgetType: BudgetType;
  budget: string;
  startDate: string;
  endDate: string;
  imageUrl: string;
  primaryText: string;
  headline: string;
}

const DEFAULT_WIZARD: WizardState = {
  objective: "OUTCOME_TRAFFIC",
  ageMin: 18,
  ageMax: 65,
  gender: "all",
  locationSearch: "",
  locationKey: "",
  locationName: "",
  locationRadius: 15,
  budgetType: "daily",
  budget: "20",
  startDate: new Date().toISOString().slice(0, 10),
  endDate: "",
  imageUrl: "",
  primaryText: "",
  headline: "",
};

function CampaignsPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchCampaigns = useServerFn(getCampaigns);
  const fetchRoas = useServerFn(getCampaignRoas);
  const fetchSpend = useServerFn(getAdSpend);
  const saveCampaign = useServerFn(upsertCampaign);
  const saveSpend = useServerFn(upsertAdSpend);
  const removeSpend = useServerFn(deleteAdSpend);
  const publishToMeta = useServerFn(publishMetaAd);
  const searchLocations = useServerFn(searchMetaLocations);
  const syncInsights = useServerFn(syncMetaInsights);
  const updateStatus = useServerFn(updateMetaCampaignStatus);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"roas" | "spend">("roas");
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [showSpendForm, setShowSpendForm] = useState(false);
  const [showMetaPublishModal, setShowMetaPublishModal] = useState<any>(null);
  const [wizardStep, setWizardStep] = useState(1);
  const [wizard, setWizard] = useState<WizardState>(DEFAULT_WIZARD);
  const [locationResults, setLocationResults] = useState<Array<{ key: string; name: string; region: string }>>([]);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDebounce = useRef<ReturnType<typeof setTimeout>>();

  const [campaignForm, setCampaignForm] = useState({ name: "", platform: "meta", utm_campaign: "" });
  const [spendForm, setSpendForm] = useState({
    campaign_id: "",
    date: new Date().toISOString().slice(0, 10),
    amount: "",
  });

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

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

  const [togglingId, setTogglingId] = useState<string | null>(null);

  const statusMutation = useMutation({
    mutationFn: ({ campaignId, status }: { campaignId: string; status: "ACTIVE" | "PAUSED" }) =>
      updateStatus({ data: { campaignId, status } }),
    onMutate: ({ campaignId }) => setTogglingId(campaignId),
    onSuccess: (_res, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      toast.success(status === "ACTIVE" ? "Campanha ativada no Meta!" : "Campanha pausada no Meta.");
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setTogglingId(null),
  });

  const syncMutation = useMutation({
    mutationFn: () => syncInsights({ data: { restaurantId: restaurant!.id } }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      queryClient.invalidateQueries({ queryKey: ["ad-spend"] });
      toast.success(
        `Sincronizado! ${res.synced} campanha(s) · R$ ${Number(res.totalSpend).toLocaleString("pt-BR", { minimumFractionDigits: 2 })} · ${Number(res.totalImpressions).toLocaleString("pt-BR")} impressões`
      );
    },
    onError: (e: any) => toast.error(e.message),
  });

  const metaMutation = useMutation({
    mutationFn: (payload: any) => publishToMeta({ data: payload }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      closeWizard();
      toast.success("Anúncio enviado ao Meta! Revise no Gerenciador antes de ativar.", {
        action: {
          label: "Ver no Meta",
          onClick: () => window.open(res.adsManagerUrl, "_blank"),
        },
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openWizard = (campaign: any) => {
    setShowMetaPublishModal(campaign);
    setWizardStep(1);
    setWizard({ ...DEFAULT_WIZARD, headline: campaign.name.slice(0, 40) });
    setLocationResults([]);
    setShowLocationDropdown(false);
  };

  const closeWizard = () => {
    setShowMetaPublishModal(null);
    setWizardStep(1);
  };

  const handleLocationInput = (value: string) => {
    setWizard(w => ({ ...w, locationSearch: value, locationKey: "", locationName: "" }));
    setLocationResults([]);
    clearTimeout(locationDebounce.current);
    if (value.length < 2) { setShowLocationDropdown(false); return; }
    locationDebounce.current = setTimeout(async () => {
      setSearchingLocation(true);
      try {
        const results = await searchLocations({ data: { restaurantId: restaurant!.id, query: value } });
        setLocationResults(results as any[]);
        setShowLocationDropdown(true);
      } catch { /* ignore */ }
      finally { setSearchingLocation(false); }
    }, 500);
  };

  const selectLocation = (loc: { key: string; name: string; region: string }) => {
    setWizard(w => ({ ...w, locationKey: loc.key, locationName: loc.name, locationSearch: `${loc.name}, ${loc.region}` }));
    setShowLocationDropdown(false);
  };

  const canAdvance = () => {
    if (wizardStep === 3) {
      if (!wizard.budget || parseFloat(wizard.budget) < 5) return false;
      if (!wizard.startDate) return false;
      if (wizard.budgetType === "lifetime" && !wizard.endDate) return false;
    }
    if (wizardStep === 4) {
      if (!wizard.imageUrl || !wizard.primaryText || !wizard.headline) return false;
    }
    return true;
  };

  const handleSubmit = () => {
    if (!canAdvance()) return;
    const destinationUrl = `${window.location.origin}/r/${restaurant!.slug}?utm_source=meta&utm_medium=paid&utm_campaign=${showMetaPublishModal.utm_campaign}`;
    const genderIds = wizard.gender === "male" ? [1] : wizard.gender === "female" ? [2] : [];
    metaMutation.mutate({
      campaignId: showMetaPublishModal.id,
      adData: {
        imageUrl: wizard.imageUrl,
        primaryText: wizard.primaryText,
        headline: wizard.headline,
        destinationUrl,
        objective: wizard.objective,
        budgetType: wizard.budgetType,
        budget: parseFloat(wizard.budget),
        startDate: wizard.startDate,
        endDate: wizard.endDate || null,
        ageMin: wizard.ageMin,
        ageMax: wizard.ageMax,
        genderIds,
        locationKey: wizard.locationKey || undefined,
        locationRadius: wizard.locationRadius,
      },
    });
  };

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
          {restaurant?.meta_access_token && roas?.some((c: any) => c.meta_ad_id) && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
              title={roas?.find((c: any) => c.meta_last_synced_at)
                ? `Última sync: ${new Date((roas.find((c: any) => c.meta_last_synced_at) as any).meta_last_synced_at).toLocaleString("pt-BR")}`
                : "Sincronizar dados do Meta"}
            >
              <RefreshCw size={15} className={syncMutation.isPending ? "animate-spin" : ""} />
              {syncMutation.isPending ? "Sincronizando..." : "Sincronizar Meta"}
            </button>
          )}
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
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loadingRoas && (
                <tr><td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">Carregando...</td></tr>
              )}
              {!loadingRoas && roas?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhuma campanha ainda. Crie uma e lance o gasto para ver o ROAS.
                  </td>
                </tr>
              )}
              {roas?.map(c => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3">
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-muted-foreground">utm_campaign={c.utm_campaign}</p>
                    {((c as any).meta_impressions > 0 || (c as any).meta_clicks > 0) && (
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Layers size={10} />
                          {Number((c as any).meta_impressions).toLocaleString("pt-BR")} impressões
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MousePointerClick size={10} />
                          {Number((c as any).meta_clicks).toLocaleString("pt-BR")} cliques
                        </span>
                        {(c as any).meta_impressions > 0 && (c as any).meta_clicks > 0 && (
                          <span className="text-[11px] text-muted-foreground">
                            CTR {((Number((c as any).meta_clicks) / Number((c as any).meta_impressions)) * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                    )}
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
                  <td className="px-5 py-3 text-right">
                    {(c as any).meta_ad_id ? (
                      <div className="flex items-center justify-end gap-2">
                        {(c as any).meta_status === "active" ? (
                          <>
                            <span className="text-[10px] font-bold text-green-600 border border-green-500 bg-green-50 dark:bg-green-950/20 px-1.5 py-0.5 rounded uppercase">
                              Ativo
                            </span>
                            <button
                              onClick={() => statusMutation.mutate({ campaignId: c.id, status: "PAUSED" })}
                              disabled={togglingId === c.id}
                              className="flex items-center gap-1 text-xs text-muted-foreground border rounded-md px-2 py-1 hover:bg-accent disabled:opacity-50"
                              title="Pausar campanha"
                            >
                              {togglingId === c.id
                                ? <RefreshCw size={11} className="animate-spin" />
                                : <Pause size={11} />}
                              Pausar
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="text-[10px] font-bold text-muted-foreground border px-1.5 py-0.5 rounded uppercase">
                              Pausado
                            </span>
                            <button
                              onClick={() => statusMutation.mutate({ campaignId: c.id, status: "ACTIVE" })}
                              disabled={togglingId === c.id}
                              className="flex items-center gap-1 text-xs font-semibold text-green-600 border border-green-500 rounded-md px-2 py-1 hover:bg-green-50 dark:hover:bg-green-950/20 disabled:opacity-50"
                              title="Ativar campanha"
                            >
                              {togglingId === c.id
                                ? <RefreshCw size={11} className="animate-spin" />
                                : <Play size={11} />}
                              Ativar
                            </button>
                          </>
                        )}
                        <Facebook size={13} className="text-[#1877F2] shrink-0" />
                      </div>
                    ) : (
                      restaurant?.meta_access_token && (
                        <button
                          onClick={() => openWizard(c)}
                          className="flex items-center gap-1.5 ml-auto text-xs font-semibold bg-[#1877F2] text-white px-2.5 py-1.5 rounded-md hover:opacity-90 transition-opacity"
                        >
                          <Facebook size={12} />
                          Publicar no Meta
                        </button>
                      )
                    )}
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
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{(s as any).campaigns?.name ?? "—"}</span>
                      {(s as any).source === "meta" && (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-[#1877F2] border border-[#1877F2]/30 bg-blue-50 dark:bg-blue-950/20 px-1.5 py-0.5 rounded">
                          <Facebook size={9} /> Meta
                        </span>
                      )}
                    </div>
                  </td>
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

      {/* Meta Publish Wizard */}
      {showMetaPublishModal && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[92vh]">

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b shrink-0">
              <Facebook className="text-[#1877F2] shrink-0" size={20} />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base leading-tight">Publicar no Meta Ads</p>
                <p className="text-xs text-muted-foreground">
                  Passo {wizardStep}/4 — {STEP_LABELS[wizardStep - 1]}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4].map(s => (
                  <div
                    key={s}
                    className={`h-1.5 rounded-full transition-all ${
                      s < wizardStep ? "w-5 bg-[#1877F2]" :
                      s === wizardStep ? "w-5 bg-[#1877F2]" :
                      "w-2.5 bg-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <button onClick={closeWizard} className="p-1 rounded hover:bg-accent ml-1">
                <X size={16} />
              </button>
            </div>

            {/* Step Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5">

              {/* Step 1 — Objetivo */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Qual o objetivo principal desta campanha?
                  </p>
                  <div className="space-y-3">
                    {OBJECTIVES.map(obj => {
                      const Icon = obj.icon;
                      const selected = wizard.objective === obj.id;
                      return (
                        <button
                          key={obj.id}
                          type="button"
                          onClick={() => setWizard(w => ({ ...w, objective: obj.id }))}
                          className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? "border-[#1877F2] bg-blue-50/50 dark:bg-blue-950/20"
                              : "border-border hover:border-muted-foreground/50 hover:bg-accent/40"
                          }`}
                        >
                          <div className={`p-2.5 rounded-lg ${selected ? "bg-[#1877F2] text-white" : "bg-muted"}`}>
                            <Icon size={20} />
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{obj.label}</p>
                            <p className="text-xs text-muted-foreground">{obj.desc}</p>
                          </div>
                          {selected && (
                            <div className="ml-auto w-4 h-4 rounded-full bg-[#1877F2] flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-white" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 2 — Público */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Para quem você quer mostrar este anúncio?
                  </p>

                  {/* Location search */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium flex items-center gap-1.5">
                      <MapPin size={14} /> Cidade (opcional)
                    </label>
                    <div className="relative">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          className="w-full border rounded-md pl-8 pr-3 py-2 bg-background text-sm"
                          placeholder="Ex: São Paulo, Porto Alegre..."
                          value={wizard.locationSearch}
                          onChange={e => handleLocationInput(e.target.value)}
                          onFocus={() => locationResults.length > 0 && setShowLocationDropdown(true)}
                        />
                        {searchingLocation && (
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        )}
                      </div>
                      {showLocationDropdown && locationResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                          {locationResults.map(loc => (
                            <button
                              key={loc.key}
                              type="button"
                              onClick={() => selectLocation(loc)}
                              className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                            >
                              <span className="font-medium">{loc.name}</span>
                              {loc.region && <span className="text-muted-foreground ml-1">— {loc.region}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {wizard.locationKey && (
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/20 border border-blue-200 rounded-md px-3 py-1.5 text-xs">
                        <span className="text-blue-700 dark:text-blue-300 font-medium">{wizard.locationSearch}</span>
                        <button
                          type="button"
                          onClick={() => setWizard(w => ({ ...w, locationKey: "", locationName: "", locationSearch: "" }))}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}
                    {!wizard.locationKey && (
                      <p className="text-xs text-muted-foreground">Sem cidade selecionada, o anúncio alcança todo o Brasil.</p>
                    )}
                  </div>

                  {/* Radius (only when city selected) */}
                  {wizard.locationKey && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Raio ao redor da cidade</label>
                      <div className="flex gap-2">
                        {[5, 10, 15, 20, 30].map(r => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setWizard(w => ({ ...w, locationRadius: r }))}
                            className={`flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                              wizard.locationRadius === r
                                ? "bg-[#1877F2] text-white border-[#1877F2]"
                                : "hover:bg-accent border-border"
                            }`}
                          >
                            {r}km
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Age range */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Faixa de idade</label>
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          min="18"
                          max={wizard.ageMax}
                          className="w-full border rounded-md px-3 py-2 bg-background text-sm text-center"
                          value={wizard.ageMin}
                          onChange={e => setWizard(w => ({ ...w, ageMin: parseInt(e.target.value) || 18 }))}
                        />
                        <p className="text-[10px] text-center text-muted-foreground mt-0.5">Mínimo</p>
                      </div>
                      <span className="text-muted-foreground text-sm">até</span>
                      <div className="flex-1">
                        <input
                          type="number"
                          min={wizard.ageMin}
                          max="65"
                          className="w-full border rounded-md px-3 py-2 bg-background text-sm text-center"
                          value={wizard.ageMax}
                          onChange={e => setWizard(w => ({ ...w, ageMax: parseInt(e.target.value) || 65 }))}
                        />
                        <p className="text-[10px] text-center text-muted-foreground mt-0.5">Máximo</p>
                      </div>
                    </div>
                  </div>

                  {/* Gender */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Gênero</label>
                    <div className="grid grid-cols-3 gap-2">
                      {([["all", "Todos"], ["male", "Homens"], ["female", "Mulheres"]] as const).map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setWizard(w => ({ ...w, gender: val as Gender }))}
                          className={`py-2 rounded-md text-sm font-medium border transition-colors ${
                            wizard.gender === val
                              ? "bg-[#1877F2] text-white border-[#1877F2]"
                              : "hover:bg-accent border-border"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3 — Orçamento */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <p className="text-sm text-muted-foreground">
                    Quanto você quer investir nesta campanha?
                  </p>

                  {/* Budget type toggle */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Tipo de orçamento</label>
                    <div className="grid grid-cols-2 gap-2">
                      {([["daily", "Diário", "Renova todo dia"] as const, ["lifetime", "Total da campanha", "Gasta até encerrar"] as const]).map(([val, label, desc]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setWizard(w => ({ ...w, budgetType: val }))}
                          className={`p-3 rounded-xl border-2 text-left transition-all ${
                            wizard.budgetType === val
                              ? "border-[#1877F2] bg-blue-50/50 dark:bg-blue-950/20"
                              : "border-border hover:border-muted-foreground/50"
                          }`}
                        >
                          <p className="text-sm font-semibold">{label}</p>
                          <p className="text-[11px] text-muted-foreground">{desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Budget amount */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">
                      {wizard.budgetType === "daily" ? "Orçamento diário (R$)" : "Orçamento total (R$)"}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                      <input
                        type="number"
                        min="5"
                        step="1"
                        className="w-full border rounded-md pl-9 pr-3 py-2.5 bg-background text-sm font-medium"
                        value={wizard.budget}
                        onChange={e => setWizard(w => ({ ...w, budget: e.target.value }))}
                        placeholder="20"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">Mínimo de R$ 5,00.</p>
                    {/* Quick values */}
                    <div className="flex gap-2 pt-1">
                      {(wizard.budgetType === "daily" ? [10, 20, 30, 50] : [100, 200, 500]).map(v => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setWizard(w => ({ ...w, budget: String(v) }))}
                          className="px-3 py-1 text-xs rounded-full border hover:bg-accent"
                        >
                          R$ {v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1">
                        <Calendar size={13} /> Início
                      </label>
                      <input
                        type="date"
                        className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                        value={wizard.startDate}
                        onChange={e => setWizard(w => ({ ...w, startDate: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium flex items-center gap-1">
                        <Calendar size={13} />
                        {wizard.budgetType === "lifetime" ? "Fim (obrigatório)" : "Fim (opcional)"}
                      </label>
                      <input
                        type="date"
                        className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                        value={wizard.endDate}
                        onChange={e => setWizard(w => ({ ...w, endDate: e.target.value }))}
                        required={wizard.budgetType === "lifetime"}
                        min={wizard.startDate}
                      />
                    </div>
                  </div>
                  {wizard.budgetType === "lifetime" && !wizard.endDate && (
                    <p className="text-xs text-destructive">Data de fim obrigatória para orçamento total.</p>
                  )}
                </div>
              )}

              {/* Step 4 — Criativo */}
              {wizardStep === 4 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure o visual e o texto do seu anúncio.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">URL da Imagem</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                      value={wizard.imageUrl}
                      onChange={e => setWizard(w => ({ ...w, imageUrl: e.target.value }))}
                      placeholder="https://suaimagem.com/foto.jpg"
                    />
                    <p className="text-xs text-muted-foreground">Use uma URL pública. Tamanho recomendado: 1080×1080px.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Texto Principal</label>
                    <textarea
                      className="w-full border rounded-md px-3 py-2 bg-background text-sm min-h-[90px] resize-none"
                      value={wizard.primaryText}
                      onChange={e => setWizard(w => ({ ...w, primaryText: e.target.value }))}
                      placeholder="O melhor hambúrguer da cidade na sua porta. Peça agora!"
                      maxLength={125}
                    />
                    <div className={`text-[10px] text-right ${wizard.primaryText.length >= 115 ? "text-destructive" : "text-muted-foreground"}`}>
                      {wizard.primaryText.length}/125
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Título do Anúncio</label>
                    <input
                      className="w-full border rounded-md px-3 py-2 bg-background text-sm"
                      value={wizard.headline}
                      onChange={e => setWizard(w => ({ ...w, headline: e.target.value }))}
                      placeholder="Peça agora com frete grátis!"
                      maxLength={40}
                    />
                    <div className={`text-[10px] text-right ${wizard.headline.length >= 36 ? "text-destructive" : "text-muted-foreground"}`}>
                      {wizard.headline.length}/40
                    </div>
                  </div>

                  <div className="bg-muted/50 p-3 rounded-lg border text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <ExternalLink size={11} /> Link de destino (gerado automaticamente):
                    </p>
                    <code className="break-all text-blue-600 dark:text-blue-400 text-[11px]">
                      {restaurant?.slug
                        ? `${window.location.origin}/r/${restaurant.slug}?utm_source=meta&utm_medium=paid&utm_campaign=${showMetaPublishModal.utm_campaign}`
                        : "Carregando..."}
                    </code>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 rounded-lg p-3 text-xs text-amber-700 dark:text-amber-300">
                    A campanha será criada como <strong>PAUSADA</strong> no Meta para sua revisão antes de ativar.
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t shrink-0">
              <button
                type="button"
                onClick={() => wizardStep > 1 ? setWizardStep(s => s - 1) : closeWizard()}
                className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-md hover:bg-accent"
              >
                {wizardStep > 1 && <ChevronLeft size={15} />}
                {wizardStep > 1 ? "Voltar" : "Cancelar"}
              </button>

              {wizardStep < 4 ? (
                <button
                  type="button"
                  onClick={() => setWizardStep(s => s + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm bg-[#1877F2] text-white rounded-md hover:opacity-90 font-medium"
                >
                  Próximo <ChevronRight size={15} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={metaMutation.isPending || !canAdvance()}
                  className="flex items-center gap-2 px-5 py-2 text-sm bg-[#1877F2] text-white rounded-md hover:opacity-90 disabled:opacity-50 font-medium"
                >
                  <Facebook size={15} />
                  {metaMutation.isPending ? "Enviando..." : "Publicar no Meta"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
