import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRestaurant, updateRestaurant } from "@/lib/api/restaurant.functions";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/app/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const saveRestaurant = useServerFn(updateRestaurant);
  const queryClient = useQueryClient();

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
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

  const mutation = useMutation({
    mutationFn: (data: typeof formData) => saveRestaurant({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["restaurant"] });
      alert("Configurações salvas!");
    },
    onError: (error: any) => {
      alert(error.message);
    },
  });

  if (isLoading) return <div>Carregando...</div>;

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="text-3xl font-bold">Configurações do Restaurante</h1>
      <p className="mt-2 text-muted-foreground">Configure os dados públicos do seu restaurante.</p>

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
          className="w-full rounded-md bg-primary py-2 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {mutation.isPending ? "Salvando..." : "Salvar Configurações"}
        </button>
      </form>
    </div>
  );
}
