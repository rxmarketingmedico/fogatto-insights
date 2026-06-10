import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { getCustomers } from "@/lib/api/dashboard.functions";

export const Route = createFileRoute("/_authenticated/app/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchCustomers = useServerFn(getCustomers);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", restaurant?.id],
    queryFn: () => fetchCustomers({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant,
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {customers ? `${customers.length} clientes cadastrados` : ""}
        </p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando...</div>
      ) : (
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">WhatsApp</th>
                <th className="px-5 py-3 text-left">Primeira origem</th>
                <th className="px-5 py-3 text-left">Cadastrado em</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {customers?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-muted-foreground">
                    Nenhum cliente ainda. Compartilhe o link do cardápio para começar.
                  </td>
                </tr>
              )}
              {customers?.map(c => (
                <tr key={c.id} className="hover:bg-accent/40">
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.phone}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-1">
                      <span className="font-medium">{c.first_utm_source || "Direto"}</span>
                      {c.first_utm_campaign && (
                        <span className="text-muted-foreground">/ {c.first_utm_campaign}</span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {new Date(c.first_seen_at).toLocaleDateString("pt-BR")}
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
