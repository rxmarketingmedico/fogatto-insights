import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { getOrders } from "@/lib/api/dashboard.functions";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/audit")({
  component: AuditPage,
});

function AuditPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchOrders = useServerFn(getOrders);

  const { data: restaurant } = useQuery({ 
    queryKey: ["restaurant"], 
    queryFn: () => fetchRestaurant() 
  });
  
  const { data: orders, isLoading } = useQuery({ 
    queryKey: ["orders-audit", restaurant?.id], 
    queryFn: () => fetchOrders({ data: { restaurantId: restaurant!.id, limit: 100 } }),
    enabled: !!restaurant 
  });

  const downloadCSV = () => {
    if (!orders) return;
    const headers = ["pedido_id", "customer_id", "first_touch_at", "utm_source", "utm_medium", "utm_campaign", "fbclid", "status", "total"];
    const rows = orders.map(o => [
      o.order_code,
      o.customer_id,
      o.first_touch_at || "",
      o.utm_source || "direto",
      o.utm_medium || "",
      o.utm_campaign || "",
      o.fbclid || "",
      o.status,
      o.total
    ]);
    
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Auditoria de Pedidos</h1>
          <p className="text-muted-foreground mt-1">Verificação técnica de atribuição e rastreamento</p>
        </div>
        <Button onClick={downloadCSV} variant="outline" className="gap-2" disabled={!orders?.length}>
          <Download size={16} /> Exportar CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">Carregando dados técnicos...</div>
      ) : (
        <div className="border rounded-xl bg-card overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[100px]">Pedido</TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>First Touch</TableHead>
                <TableHead>UTM Source</TableHead>
                <TableHead>UTM Campaign</TableHead>
                <TableHead>FBCLID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders?.map((o) => (
                <TableRow key={o.id} className="hover:bg-accent/40">
                  <TableCell className="font-mono text-xs">#{o.order_code}</TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[120px]" title={o.customer_id}>
                    {o.customer_id}
                  </TableCell>
                  <TableCell className="text-xs">
                    {o.first_touch_at ? new Date(o.first_touch_at).toLocaleString("pt-BR") : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-normal">
                      {o.utm_source || "direto"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {o.utm_campaign || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-[10px] text-muted-foreground truncate max-w-[100px]" title={o.fbclid || ""}>
                    {o.fbclid || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={o.status === "paid" ? "default" : o.status === "canceled" ? "destructive" : "secondary"}
                      className="capitalize"
                    >
                      {o.status === "paid" ? "Pago" : o.status === "canceled" ? "Cancelado" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    R$ {Number(o.total).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              {(!orders || orders.length === 0) && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    Nenhum pedido encontrado para auditoria.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
