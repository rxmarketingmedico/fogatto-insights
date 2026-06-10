import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { getCampaigns, upsertCampaign, getAdSpend, upsertAdSpend } from "@/lib/api/dashboard.functions";
import { useState } from "react";
import { Plus, Target, TrendingUp } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/app/campaigns")({
  component: CampaignsPage,
});

function CampaignsPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchCampaigns = useServerFn(getCampaigns);
  const saveCampaign = useServerFn(upsertCampaign);
  const queryClient = useQueryClient();

  const { data: restaurant } = useQuery({ queryKey: ["restaurant"], queryFn: () => fetchRestaurant() });
  const { data: campaigns } = useQuery({ 
      queryKey: ["campaigns", restaurant?.id], 
      queryFn: () => fetchCampaigns({ data: { restaurantId: restaurant!.id } }),
      enabled: !!restaurant
  });

  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState({ name: "", platform: "meta", utm_campaign: "" });

  const mutation = useMutation({
    mutationFn: (data: any) => saveCampaign({ data: { ...data, restaurant_id: restaurant!.id } }),
    onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        setIsAdding(false);
        toast.success("Campanha salva!");
    }
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Campanhas</h1>
            <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:opacity-90">
                <Plus size={20} /> Nova Campanha
            </button>
        </div>

        <div className="grid gap-4">
            {campaigns?.map(c => (
                <div key={c.id} className="border p-4 rounded-xl flex items-center justify-between">
                    <div>
                        <h3 className="font-bold">{c.name}</h3>
                        <p className="text-sm text-muted-foreground">{c.platform.toUpperCase()} · utm_campaign={c.utm_campaign}</p>
                    </div>
                </div>
            ))}
        </div>

        {isAdding && (
            <div className="fixed inset-0 bg-background/80 flex items-center justify-center p-4">
                <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(formData); }} className="bg-card border p-6 rounded-xl w-full max-w-sm space-y-4 shadow-xl">
                    <h3 className="font-bold text-lg">Nova Campanha</h3>
                    <input className="w-full border rounded p-2" placeholder="Nome" onChange={e => setFormData({...formData, name: e.target.value})} required />
                    <select className="w-full border rounded p-2" onChange={e => setFormData({...formData, platform: e.target.value})} >
                        <option value="meta">Meta Ads</option>
                        <option value="google">Google Ads</option>
                        <option value="outro">Outro</option>
                    </select>
                    <input className="w-full border rounded p-2" placeholder="utm_campaign" onChange={e => setFormData({...formData, utm_campaign: e.target.value})} required />
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setIsAdding(false)} className="px-4 py-2">Cancelar</button>
                        <button className="px-4 py-2 bg-primary text-primary-foreground rounded">Salvar</button>
                    </div>
                </form>
            </div>
        )}
    </div>
  );
}
