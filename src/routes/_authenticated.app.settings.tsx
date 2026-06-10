import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRestaurant, updateRestaurant } from "@/lib/api/restaurant.functions";
import { getMetaAuthUrl, connectMetaAds, disconnectMetaAds } from "@/lib/api/meta-ads.functions";
import { useState, useEffect } from "react";
import { Facebook, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const saveRestaurant = useServerFn(updateRestaurant);
  const getMetaUrl = useServerFn(getMetaAuthUrl);
  const finalizeMeta = useServerFn(connectMetaAds);
  const removeMeta = useServerFn(disconnectMetaAds);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [metaSelection, setMetaSelection] = useState<{ adAccounts: any[]; pages: any[] } | null>(null);
  const [selectedAdAccount, setSelectedAdAccount] = useState("");
  const [selectedPage, setSelectedPage] = useState("");

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
    retry: false
  });

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    whatsapp_number: "",
    logo_url: "",
  });

  useEffect(() => {
    if (restaurant) {
      setFormData({
        name: restaurant.name || "",
        slug: restaurant.slug || "",
        whatsapp_number: restaurant.whatsapp_number || "",
        logo_url: restaurant.logo_url || "",
      });
    }
  }, [restaurant]);

  useEffect(() => {
    // Check for callback result from popup
    const interval = setInterval(() => {
      const result = localStorage.getItem("meta_callback_result");
      if (result) {
        localStorage.removeItem("meta_callback_result");
        setMetaSelection(JSON.parse(result));
      }
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const handleConnectMeta = async () => {
    try {
      if (!restaurant?.id) return;
      const { url } = await getMetaUrl({ data: { restaurantId: restaurant.id } });
      const popup = window.open(url, "meta_auth", "width=600,height=700");
      
      const timer = setInterval(() => {
        const result = localStorage.getItem("meta_callback_result");
        if (result) {
          clearInterval(timer);
          localStorage.removeItem("meta_callback_result");
          setMetaSelection(JSON.parse(result));
        }
        if (popup?.closed && !localStorage.getItem("meta_callback_result")) {
          clearInterval(timer);
        }
      }, 500);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const confirmMetaConnection = async () => {
    try {
      if (!restaurant?.id || !selectedAdAccount || !selectedPage) return;
      await finalizeMeta({
        data: {
          restaurantId: restaurant.id,
          adAccountId: selectedAdAccount,
          pageId: selectedPage,
        }
      });
      setMetaSelection(null);
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      toast.success("Meta Ads conectado com sucesso!");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleDisconnectMeta = async () => {
    if (!confirm("Tem certeza que deseja desconectar o Meta Ads?")) return;
    try {
      await removeMeta({ data: { restaurantId: restaurant!.id } });
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      toast.success("Meta Ads desconectado.");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => saveRestaurant({ data }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      if (isNewRestaurant) {
        navigate({ to: "/app/menu" });
      } else {
        alert("Configurações salvas!");
      }
    },
    onError: (error: any) => {
      alert(error.message);
    },
  });

  if (isLoading) return <div className="p-8">Carregando...</div>;

  const isNewRestaurant = !restaurant || restaurant.whatsapp_number === "00000000000";

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">
        {isNewRestaurant ? "Bem-vindo ao Fogatto!" : "Configurações do Restaurante"}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {isNewRestaurant 
          ? "Complete o cadastro do seu restaurante para começar a vender." 
          : "Configure os dados públicos do seu restaurante."}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(formData);
        }}
        className="mt-8 space-y-6"
      >
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome do Restaurante</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Link do Cardápio (slug)</label>
          <div className="flex items-center gap-2">
             <span className="text-muted-foreground text-sm">/r/</span>
             <input
              className="w-full rounded-md border bg-background px-3 py-2"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
              placeholder="ex: meu-restaurante"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">WhatsApp (com DDD)</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2"
            value={formData.whatsapp_number}
            onChange={(e) => setFormData({ ...formData, whatsapp_number: e.target.value.replace(/\D/g, "") })}
            placeholder="5511999999999"
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">URL do Logo</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-2"
            value={formData.logo_url}
            onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
            placeholder="https://..."
          />
        </div>

        <button
          disabled={mutation.isPending}
          className="w-full rounded-md bg-primary py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50 text-lg"
        >
          {mutation.isPending ? "Salvando..." : isNewRestaurant ? "Finalizar Cadastro e Ir para Cardápio" : "Salvar Configurações"}
        </button>
      </form>

      <div className="mt-12 pt-8 border-t">
        <h2 className="text-xl font-bold">Integrações</h2>
        
        <div className="mt-6 border rounded-xl p-6 bg-card">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="bg-[#1877F2] p-2 rounded-lg">
                <Facebook className="text-white" size={24} />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Meta Ads</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Publique anúncios no Facebook e Instagram diretamente pelo Fogatto.
                </p>
                
                {restaurant?.meta_access_token ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-green-600 text-sm font-medium">
                      <CheckCircle2 size={16} />
                      Conectado em {new Date(restaurant.meta_connected_at!).toLocaleDateString("pt-BR")}
                    </div>
                    {restaurant.meta_ad_account_id && (
                      <p className="text-sm text-muted-foreground">
                        Conta: <code className="bg-muted px-1 rounded">{restaurant.meta_ad_account_id}</code>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-sm font-medium text-amber-600 flex items-center gap-2">
                    <AlertCircle size={16} />
                    Não conectado
                  </p>
                )}
              </div>
            </div>
            
            {restaurant?.meta_access_token ? (
              <button 
                onClick={handleDisconnectMeta}
                className="text-sm text-destructive font-medium hover:underline"
              >
                Desconectar
              </button>
            ) : (
              <button
                onClick={handleConnectMeta}
                className="flex items-center gap-2 bg-[#1877F2] text-white px-4 py-2 rounded-lg text-sm font-medium hover:opacity-90"
              >
                Conectar Meta Ads
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Meta Selection Modal */}
      {metaSelection && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border rounded-xl shadow-xl w-full max-w-md p-6 space-y-6">
            <h3 className="font-bold text-xl">Configurar Meta Ads</h3>
            <p className="text-sm text-muted-foreground">
              Escolha qual conta de anúncios e página você deseja associar a este restaurante.
            </p>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Conta de Anúncios</label>
                <select 
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedAdAccount}
                  onChange={(e) => setSelectedAdAccount(e.target.value)}
                >
                  <option value="">Selecione uma conta...</option>
                  {metaSelection.adAccounts.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({acc.id})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Página do Facebook</label>
                <select 
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={selectedPage}
                  onChange={(e) => setSelectedPage(e.target.value)}
                >
                  <option value="">Selecione uma página...</option>
                  {metaSelection.pages.map((page: any) => (
                    <option key={page.id} value={page.id}>{page.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button 
                onClick={() => setMetaSelection(null)}
                className="px-4 py-2 text-sm font-medium border rounded-lg hover:bg-accent"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmMetaConnection}
                disabled={!selectedAdAccount || !selectedPage}
                className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                Confirmar Conexão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
