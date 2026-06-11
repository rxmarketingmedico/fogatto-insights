import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getMenuItemsForAd = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({ restaurantId: z.string() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: items, error } = await supabase
      .from("menu_items")
      .select("id, name, description, price, photo_url")
      .eq("restaurant_id", data.restaurantId)
      .eq("active", true)
      .order("position");
    if (error) throw error;
    return items;
  });

export const generateAdCreative = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string(),
      menuItemId: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Chave OpenAI não configurada. Adicione OPENAI_API_KEY nas configurações do Lovable."
      );
    }

    const [{ data: restaurant }, { data: item }] = await Promise.all([
      supabase
        .from("restaurants")
        .select("name, logo_url")
        .eq("id", data.restaurantId)
        .single(),
      supabase
        .from("menu_items")
        .select("name, description, price, photo_url")
        .eq("id", data.menuItemId)
        .single(),
    ]);

    if (!restaurant || !item) throw new Error("Dados não encontrados.");

    // Run image generation and copy generation in parallel
    const [imageUrl, copy] = await Promise.all([
      generateImage(apiKey, restaurant.name, item),
      generateCopy(apiKey, restaurant.name, item),
    ]);

    return {
      imageUrl,
      primaryText: (copy.primaryText ?? "").slice(0, 125),
      headline: (copy.headline ?? "").slice(0, 40),
    };
  });

// ─── Image generation ────────────────────────────────────────────────────────

async function generateImage(
  apiKey: string,
  restaurantName: string,
  item: { name: string; description: string | null; price: number; photo_url: string | null }
): Promise<string> {
  // If item has a photo, use gpt-image-1 to edit/enhance it
  if (item.photo_url) {
    return editImageWithAI(apiKey, restaurantName, item);
  }
  // Otherwise generate from scratch with DALL-E 3
  return generateImageFromText(apiKey, restaurantName, item);
}

async function generateImageFromText(
  apiKey: string,
  restaurantName: string,
  item: { name: string; description: string | null }
): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: buildDallePrompt(restaurantName, item),
      n: 1,
      size: "1024x1024",
      quality: "hd",
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Erro DALL-E: ${data.error.message}`);
  return data.data[0].url as string;
}

async function editImageWithAI(
  apiKey: string,
  restaurantName: string,
  item: { name: string; description: string | null; photo_url: string | null }
): Promise<string> {
  // Fetch the original image and convert to base64 for the API
  const imgRes = await fetch(item.photo_url!);
  const imgBlob = await imgRes.blob();
  const arrayBuffer = await imgBlob.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const mimeType = imgBlob.type || "image/jpeg";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: buildEditPrompt(restaurantName, item),
      n: 1,
      size: "1024x1024",
      quality: "high",
      // Pass the source image as reference
      image: [{ type: "input_image", image_url: `data:${mimeType};base64,${base64}` }],
    }),
  });
  const data = await res.json();

  // gpt-image-1 returns base64 image, not a URL
  if (data.error) {
    // Fall back to DALL-E 3 if gpt-image-1 fails (e.g. not available on current plan)
    console.warn("gpt-image-1 failed, falling back to DALL-E 3:", data.error.message);
    return generateImageFromText(apiKey, restaurantName, item);
  }

  // Convert base64 response back to a data URL for immediate use
  const b64Image = data.data[0].b64_json as string;
  return `data:image/png;base64,${b64Image}`;
}

// ─── Copy generation ─────────────────────────────────────────────────────────

async function generateCopy(
  apiKey: string,
  restaurantName: string,
  item: { name: string; description: string | null; price: number }
): Promise<{ primaryText?: string; headline?: string }> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: buildCopyPrompt(restaurantName, item) }],
      response_format: { type: "json_object" },
      max_tokens: 250,
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(`Erro GPT: ${data.error.message}`);
  return JSON.parse(data.choices[0].message.content);
}

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildDallePrompt(
  restaurantName: string,
  item: { name: string; description: string | null }
): string {
  return `Você é um especialista em marketing gastronômico e design de anúncios para Meta Ads.

Crie uma fotografia publicitária profissional do prato abaixo para o restaurante "${restaurantName}":

Prato: ${item.name}
${item.description ? `Descrição: ${item.description}` : ""}

DIRETRIZES VISUAIS:
- Realce texturas, brilho, crocância, suculência e frescor do alimento
- Faça parecer recém-preparado
- Utilize iluminação gastronômica premium com profundidade e foco profissional
- Destaque os ingredientes mais apetitosos
- Adicione vapor ou efeitos sutis de calor quando apropriado
- Estilo visual semelhante a campanhas premium de delivery
- Aparência extremamente realista, priorize impacto visual e desejo de consumo
- Fundo escuro (mármore ou madeira rústica), composição quadrada 1:1
- Sem texto, sem logos, sem marcas d'água`;
}

function buildEditPrompt(
  restaurantName: string,
  item: { name: string; description: string | null }
): string {
  return `Você é um especialista em marketing gastronômico para Meta Ads do restaurante "${restaurantName}".

Transforme esta foto do prato "${item.name}" em um anúncio altamente persuasivo para delivery.
${item.description ? `Descrição do prato: ${item.description}` : ""}

DIRETRIZES VISUAIS:
- Utilize a foto enviada como elemento principal, mantendo o alimento fiel ao original
- Realce texturas, brilho, crocância, suculência e frescor
- Faça parecer recém-preparado com iluminação gastronômica premium
- Crie profundidade, foco profissional e destaque os ingredientes mais apetitosos
- Adicione vapor ou efeitos sutis de calor se apropriado
- Estilo visual semelhante a campanhas premium de delivery
- Aparência extremamente realista
- Sem texto, sem logos, sem marcas d'água`;
}

// ─── Video Script generation ─────────────────────────────────────────────────

export const generateVideoScript = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string(),
      menuItemId: z.string(),
      template: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "Chave OpenAI não configurada. Adicione OPENAI_API_KEY nas configurações do Lovable."
      );
    }

    const [{ data: restaurant }, { data: item }] = await Promise.all([
      supabase.from("restaurants").select("name").eq("id", data.restaurantId).single(),
      supabase.from("menu_items").select("name, description, category").eq("id", data.menuItemId).single(),
    ]);

    if (!restaurant || !item) throw new Error("Dados não encontrados.");

    const prompt = buildVideoScriptPrompt(restaurant.name, item, data.template);

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1800,
        temperature: 0.8,
      }),
    });
    const result = await res.json();
    if (result.error) throw new Error(`Erro GPT: ${result.error.message}`);
    return { script: result.choices[0].message.content as string };
  });

function buildVideoScriptPrompt(
  restaurantName: string,
  item: { name: string; description: string | null; category?: string | null },
  template: string
): string {
  return `Você é um diretor criativo especializado em anúncios para restaurantes locais.

Sua tarefa é criar um roteiro de gravação para um anúncio em vídeo vertical (9:16) destinado ao Meta Ads.

INFORMAÇÕES

Restaurante: ${restaurantName}
Produto: ${item.name}
Descrição: ${item.description || "não informada"}
Categoria: ${item.category || "prato principal"}
Objetivo: gerar pedidos via delivery.
Template escolhido: ${template}
Público-alvo: clientes locais interessados em delivery.

INSTRUÇÕES

Analise o produto e adapte o roteiro para destacar os aspectos mais apetitosos e persuasivos.

Retorne exatamente nos seguintes blocos:

# CONCEITO DO ANÚNCIO

Explique em poucas linhas qual emoção será explorada.

# DURAÇÃO

Informe a duração ideal do vídeo.

# ROTEIRO DE GRAVAÇÃO

Para cada cena informe:

* Tempo
* O que filmar
* Enquadramento
* Movimento de câmera
* Texto na tela
* Narração (se houver)

# CHECKLIST DE CAPTAÇÃO

Liste todos os takes necessários para gravar o anúncio.

# COPY PRINCIPAL

Gere a copy do anúncio.

# HEADLINE

Gere 3 opções.

# CTA

Gere 3 opções.

# DICAS DE EDIÇÃO

Sugira:

* velocidade dos cortes
* estilo visual
* trilha recomendada
* transições
* efeitos de texto

REGRAS

* Priorize vídeos entre 10 e 20 segundos.
* O vídeo deve parecer um anúncio profissional.
* As cenas devem ser fáceis de gravar com celular.
* Não crie cenas impossíveis para restaurantes comuns.
* Adapte o roteiro automaticamente ao tipo de prato.`;
}

function buildCopyPrompt(
  restaurantName: string,
  item: { name: string; description: string | null; price: number }
): string {
  return `Você é um especialista em marketing gastronômico e design de anúncios para Meta Ads.

Sua tarefa é criar o copy de um anúncio altamente persuasivo para delivery.

INFORMAÇÕES DO PRODUTO:
Nome do prato: ${item.name}
Descrição: ${item.description || "não informada"}
Restaurante: ${restaurantName}
Preço: R$ ${Number(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

OBJETIVO: Gerar desejo imediato, despertar fome e aumentar a taxa de pedidos.

DIRETRIZES DE COPY:
Analise automaticamente o tipo de prato e adapte a comunicação:
- Se for hambúrguer: destaque suculência e tamanho generoso
- Se for pizza: destaque o queijo e variedade de sabores
- Se for sushi: destaque frescor e sofisticação
- Se for sobremesa: destaque indulgência e prazer
- Se for prato executivo: destaque praticidade e refeição completa
- Se for frango/assados: destaque crocância e tempero
- Nunca use textos genéricos — adapte ao alimento

RETORNE APENAS este JSON:
{
  "primaryText": "texto principal em português, máximo 120 caracteres, desperta desejo e termina com call-to-action. Emojis permitidos.",
  "headline": "título em português, máximo 38 caracteres, impactante e direto"
}`;
}
