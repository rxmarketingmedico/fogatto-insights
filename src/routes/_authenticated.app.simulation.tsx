import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ExternalLink, Database, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/simulation")({
  component: SimulationPage,
});

function SimulationPage() {
  const [utmSource, setUtmSource] = useState("facebook");
  const [utmCampaign, setUtmCampaign] = useState("verao_2024");
  const [fbclid, setFbclid] = useState("fb_" + Math.random().toString(36).substring(7));
  const [logs, setLogs] = useState<{ type: 'storage' | 'supabase', data: any, timestamp: string }[]>([]);

  const storedData = typeof window !== 'undefined' ? localStorage.getItem("fogatto_attribution_v1") : null;

  const simulateVisit = () => {
    const url = new URL(window.location.origin + "/r/burguer-tech");
    url.searchParams.set("utm_source", utmSource);
    url.searchParams.set("utm_campaign", utmCampaign);
    url.searchParams.set("fbclid", fbclid);
    
    window.open(url.toString(), "_blank");
    toast.success("Simulação de visita aberta em nova aba!");
  };

  const clearStorage = () => {
    localStorage.removeItem("fogatto_attribution_v1");
    toast.info("LocalStorage limpo");
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Simulador de Atribuição</h1>
        <p className="text-muted-foreground mt-1">Teste o fluxo de UTMs e rastreamento sem sair do ambiente</p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold border-b pb-2">Configurar Visita</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">UTM Source</label>
              <input 
                className="w-full mt-1 px-3 py-2 border rounded-md" 
                value={utmSource} 
                onChange={e => setUtmSource(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">UTM Campaign</label>
              <input 
                className="w-full mt-1 px-3 py-2 border rounded-md" 
                value={utmCampaign} 
                onChange={e => setUtmCampaign(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium uppercase text-muted-foreground">FBCLID (simulado)</label>
              <input 
                className="w-full mt-1 px-3 py-2 border rounded-md" 
                value={fbclid} 
                onChange={e => setFbclid(e.target.value)}
              />
            </div>
            <Button onClick={simulateVisit} className="w-full gap-2 mt-4">
              <ExternalLink size={16} /> Abrir Cardápio com UTMs
            </Button>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-lg font-semibold">Estado Atual (LocalStorage)</h2>
            <Button variant="ghost" size="sm" onClick={clearStorage} className="text-destructive">
              <Trash2 size={14} />
            </Button>
          </div>
          
          {storedData ? (
            <div className="space-y-3">
              <div className="bg-muted p-3 rounded-md font-mono text-xs overflow-auto max-h-48">
                {JSON.stringify(JSON.parse(storedData), null, 2)}
              </div>
              <div className="flex items-center gap-2 text-sm text-green-600 font-medium">
                <Database size={16} /> Dados prontos para o pedido
              </div>
              <p className="text-xs text-muted-foreground">
                Estes dados serão enviados ao Supabase assim que você finalizar um pedido no cardápio simulado.
              </p>
            </div>
          ) : (
            <div className="py-10 text-center text-muted-foreground">
              Nenhum dado de atribuição encontrado no navegador.
              Abra o link acima para gerar um novo first touch.
            </div>
          )}
        </Card>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <p className="font-semibold">Como testar:</p>
        <ol className="list-decimal ml-4 mt-2 space-y-1">
          <li>Preencha os campos de UTM e clique em "Abrir Cardápio".</li>
          <li>No cardápio, adicione itens e finalize o pedido.</li>
          <li>Volte aqui e veja a página de Auditoria para confirmar o registro no Supabase.</li>
        </ol>
      </div>
    </div>
  );
}