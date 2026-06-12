import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_stats",
      description: "Retorna estatísticas recentes do restaurante: receita, total de pedidos, ticket médio e distribuição por origem UTM nos últimos 30 dias.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "list_campaigns",
      description: "Lista as campanhas do restaurante com ROAS, gastos e receita atribuída.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Cria uma nova campanha no Fogatto. Use quando o usuário quiser criar uma campanha e já tiver fornecido nome, plataforma e utm_campaign.",
      parameters: {
        type: "object",
        properties: {
          name:         { type: "string", description: "Nome descritivo da campanha, ex: 'Promoção Fim de Semana'" },
          platform:     { type: "string", enum: ["meta", "google", "outro"], description: "Plataforma de anúncio" },
          utm_campaign: { type: "string", description: "Valor exato do parâmetro utm_campaign, sem espaços, ex: promo_fim_semana" },
        },
        required: ["name", "platform", "utm_campaign"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_orders",
      description: "Lista os pedidos mais recentes do restaurante com status, cliente, origem UTM e valor.",
      parameters: {
        type: "object",
        properties: {
          limit:  { type: "number", description: "Quantos pedidos retornar (padrão 10, máximo 30)" },
          status: { type: "string", enum: ["all", "paid", "queued", "canceled"], description: "Filtrar por status" },
        },
        required: [],
      },
    },
  },
];

export const chatWithCopilot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string().uuid(),
      messages: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string(),
      })),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Chave OpenAI não configurada nas variáveis de ambiente.");

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("name, slug")
      .eq("id", data.restaurantId)
      .single();

    if (!restaurant) throw new Error("Restaurante não encontrado.");

    const systemPrompt = `Você é o Fogatto Copilot, assistente inteligente do restaurante "${restaurant.name}".

Você ajuda o dono do restaurante a:
- Criar e gerenciar campanhas de marketing
- Analisar métricas: receita, pedidos, ROAS, ticket médio
- Entender atribuição: de onde vêm os clientes (UTM source/campaign)
- Tomar decisões baseadas nos dados reais do negócio

Você tem acesso a ferramentas para buscar dados reais e criar campanhas diretamente no sistema. Use-as quando precisar de dados atuais — nunca invente números.

Quando criar uma campanha, guie o usuário com perguntas: nome, plataforma (Meta/Google/Outro) e utm_campaign. Só crie quando tiver todos os dados confirmados.

Responda sempre em português brasileiro, de forma direta e prática. Use formatação com **negrito** e listas quando ajudar a clareza. Para números, use formato brasileiro (R$ 1.234,56).`;

    const oaiMessages: any[] = [
      { role: "system", content: systemPrompt },
      ...data.messages,
    ];

    const actions: any[] = [];

    // Call loop — handles up to 3 tool call rounds
    for (let i = 0; i < 3; i++) {
      const resp = await callOpenAI(apiKey, oaiMessages);
      const choice = resp.choices[0];

      if (choice.finish_reason === "tool_calls") {
        oaiMessages.push(choice.message);
        for (const tc of choice.message.tool_calls) {
          const args = JSON.parse(tc.function.arguments || "{}");
          let result: any;
          try {
            result = await executeTool(tc.function.name, args, supabase, data.restaurantId, actions);
          } catch (e: any) {
            result = { error: e.message };
          }
          oaiMessages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
        continue;
      }

      return { message: choice.message.content as string, actions };
    }

    return { message: "Não consegui processar sua solicitação. Tente de novo.", actions };
  });

async function callOpenAI(apiKey: string, messages: any[]) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages,
      tools: TOOLS,
      tool_choice: "auto",
      max_tokens: 1200,
      temperature: 0.7,
    }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`OpenAI: ${json.error.message}`);
  return json;
}

async function executeTool(
  name: string,
  args: any,
  supabase: any,
  restaurantId: string,
  actions: any[]
) {
  switch (name) {
    case "get_stats": {
      const from = new Date(Date.now() - 30 * 86400000).toISOString();
      const { data: orders } = await supabase
        .from("orders")
        .select("total, status, utm_source, utm_campaign")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", from);

      const all = orders ?? [];
      const paid = all.filter((o: any) => o.status === "paid");
      const revenue = paid.reduce((s: number, o: any) => s + Number(o.total), 0);

      const bySource = all.reduce((acc: any, o: any) => {
        const k = o.utm_source || "direto";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {});

      return {
        periodo: "últimos 30 dias",
        totalPedidos: all.length,
        pedidosPagos: paid.length,
        receitaPaga: revenue,
        ticketMedio: paid.length > 0 ? revenue / paid.length : 0,
        pedidosPorOrigem: bySource,
      };
    }

    case "list_campaigns": {
      const [{ data: campaigns }, { data: spends }, { data: orders }] = await Promise.all([
        supabase.from("campaigns").select("id, name, platform, utm_campaign, status").eq("restaurant_id", restaurantId),
        supabase.from("ad_spend").select("campaign_id, amount").eq("restaurant_id", restaurantId),
        supabase.from("orders").select("utm_campaign, total, status").eq("restaurant_id", restaurantId).eq("status", "paid"),
      ]);

      const spendMap = (spends ?? []).reduce((acc: any, s: any) => {
        acc[s.campaign_id] = (acc[s.campaign_id] || 0) + Number(s.amount);
        return acc;
      }, {});
      const revMap = (orders ?? []).reduce((acc: any, o: any) => {
        if (o.utm_campaign) acc[o.utm_campaign] = (acc[o.utm_campaign] || 0) + Number(o.total);
        return acc;
      }, {});

      return (campaigns ?? []).map((c: any) => ({
        nome: c.name,
        plataforma: c.platform,
        utm_campaign: c.utm_campaign,
        gasto: spendMap[c.id] || 0,
        receitaAtribuida: revMap[c.utm_campaign] || 0,
        roas: spendMap[c.id] > 0 ? (revMap[c.utm_campaign] || 0) / spendMap[c.id] : null,
      }));
    }

    case "create_campaign": {
      const { data: campaign, error } = await supabase
        .from("campaigns")
        .insert({
          restaurant_id: restaurantId,
          name: args.name,
          platform: args.platform,
          utm_campaign: args.utm_campaign,
          status: "active",
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      actions.push({ type: "campaign_created", campaign });
      return { sucesso: true, campanha: campaign };
    }

    case "list_orders": {
      const limit = Math.min(args.limit || 10, 30);
      let query = supabase
        .from("orders")
        .select("order_code, total, status, utm_source, utm_campaign, created_at, customers(name)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (args.status && args.status !== "all") query = query.eq("status", args.status);

      const { data: orders } = await query;
      return (orders ?? []).map((o: any) => ({
        codigo: o.order_code,
        cliente: (o.customers as any)?.name || "Anônimo",
        total: Number(o.total),
        status: o.status,
        origem: o.utm_source || "direto",
        campanha: o.utm_campaign || "-",
        data: new Date(o.created_at).toLocaleDateString("pt-BR"),
      }));
    }

    default:
      return { erro: `Ferramenta desconhecida: ${name}` };
  }
}
