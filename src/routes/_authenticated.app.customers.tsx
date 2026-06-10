import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const fetchRestaurant = useServerFn(getRestaurant);

  const { data: restaurant } = useQuery({ queryKey: ["restaurant"], queryFn: () => fetchRestaurant() });
  
  const { data: customers, isLoading } = useQuery({ 
      queryKey: ["customers", restaurant?.id], 
      queryFn: async () => {
        const { data } = await supabase.from("customers").select("*").eq("restaurant_id", restaurant!.id).order("first_seen_at", { ascending: false });
        return data;
      },
      enabled: !!restaurant 
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Clientes</h1>
      {isLoading ? <div>Carregando...</div> : (
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted text-sm uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4">Nome</th>
                <th className="p-4">WhatsApp</th>
                <th className="p-4">Primeira Origem</th>
                <th className="p-4">Cadastrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers?.map(c => (
                <tr key={c.id} className="hover:bg-accent/50">
                  <td className="p-4">{c.name}</td>
                  <td className="p-4">{c.phone}</td>
                  <td className="p-4 text-xs font-medium">
                    {c.first_utm_source || "Direto"} / {c.first_utm_campaign || "-"}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(c.first_seen_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
