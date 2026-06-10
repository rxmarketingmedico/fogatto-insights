import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { getOrders } from "@/lib/api/dashboard.functions";

export const Route = createFileRoute("/_authenticated/app/orders")({
  component: OrdersPage,
});

function OrdersPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchOrders = useServerFn(getOrders);

  const { data: restaurant } = useQuery({ queryKey: ["restaurant"], queryFn: () => fetchRestaurant() });
  
  const { data: orders, isLoading } = useQuery({ 
      queryKey: ["orders", restaurant?.id], 
      queryFn: () => fetchOrders({ data: { restaurantId: restaurant!.id } }),
      enabled: !!restaurant 
  });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Pedidos</h1>
      {isLoading ? <div>Carregando...</div> : (
        <div className="border rounded-xl bg-card overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-muted text-sm uppercase tracking-wider font-bold">
              <tr>
                <th className="p-4">Cód.</th>
                <th className="p-4">Cliente</th>
                <th className="p-4">Total</th>
                <th className="p-4">Origem (UTM)</th>
                <th className="p-4">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {orders?.map(o => (
                <tr key={o.id} className="hover:bg-accent/50">
                  <td className="p-4 font-mono">#{o.order_code}</td>
                  <td className="p-4">{o.customers?.name}</td>
                  <td className="p-4 font-bold text-primary">R$ {Number(o.total).toFixed(2)}</td>
                  <td className="p-4 text-xs">
                    {o.utm_source || "-"} / {o.utm_campaign || "-"}
                  </td>
                  <td className="p-4 text-sm text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
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
