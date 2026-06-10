import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardIndex,
});

function DashboardIndex() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const navigate = useNavigate();

  const { data: restaurant, isLoading } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  useEffect(() => {
    if (!isLoading && !restaurant) {
      navigate({ to: "/app/settings" });
    }
  }, [restaurant, isLoading, navigate]);

  if (isLoading) return <div>Carregando...</div>;
  if (!restaurant) return null;

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Bem-vindo, {restaurant.name}</h1>
      <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total de Vendas" value="R$ 0,00" />
        <StatCard title="Pedidos" value="0" />
        <StatCard title="Ticket Médio" value="R$ 0,00" />
        <StatCard title="Clientes Únicos" value="0" />
      </div>
      <div className="mt-12">
         <p className="text-muted-foreground">O seu dashboard está pronto para receber pedidos.</p>
         <div className="mt-4 rounded-lg border bg-card p-4">
            <p className="font-medium">Link do seu cardápio:</p>
            <code className="mt-2 block rounded bg-muted p-2">
              {window.location.origin}/r/{restaurant.slug}
            </code>
         </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <p className="text-sm font-medium text-muted-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}
