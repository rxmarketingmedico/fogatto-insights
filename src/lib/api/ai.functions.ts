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

    // 1. Generate image with DALL-E 3
    const imageRes = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: buildImagePrompt(restaurant.name, item),
        n: 1,
        size: "1024x1024",
        quality: "standard",
      }),
    });
    const imageData = await imageRes.json();
    if (imageData.error) throw new Error(`Erro DALL-E: ${imageData.error.message}`);
    const imageUrl: string = imageData.data[0].url;

    // 2. Generate ad copy with GPT-4o-mini
    const copyRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: buildCopyPrompt(restaurant.name, item) }],
        response_format: { type: "json_object" },
        max_tokens: 200,
      }),
    });
    const copyData = await copyRes.json();
    if (copyData.error) throw new Error(`Erro GPT: ${copyData.error.message}`);

    const copy = JSON.parse(copyData.choices[0].message.content) as {
      primaryText?: string;
      headline?: string;
    };

    return {
      imageUrl,
      primaryText: (copy.primaryText ?? "").slice(0, 125),
      headline: (copy.headline ?? "").slice(0, 40),
    };
  });

function buildImagePrompt(restaurantName: string, item: {
  name: string;
  description: string | null;
  price: number;
}) {
  return [
    `Professional food advertisement photograph for a Brazilian restaurant called "${restaurantName}".`,
    `Dish: "${item.name}"${item.description ? ` — ${item.description}` : ""}.`,
    `Price shown in ad: R$ ${Number(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}.`,
    `Style: High-end food photography, warm studio lighting, shallow depth of field with soft bokeh background,`,
    `appetizing vibrant colors, beautifully plated on a clean dark marble or rustic wood surface.`,
    `Composition: Square 1:1, close-up macro shot, photorealistic, ultra-detailed.`,
    `No text, no logos, no watermarks, no people.`,
    `The food must look incredibly fresh, delicious and professionally prepared for social media advertising.`,
  ].join(" ");
}

function buildCopyPrompt(restaurantName: string, item: {
  name: string;
  description: string | null;
  price: number;
}) {
  return `Você é especialista em marketing digital para restaurantes brasileiros.
Crie um anúncio para Meta Ads (Facebook/Instagram) para o seguinte prato:

Restaurante: ${restaurantName}
Prato: ${item.name}
${item.description ? `Descrição: ${item.description}` : ""}
Preço: R$ ${Number(item.price).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}

Retorne APENAS um JSON com:
{
  "primaryText": "texto principal em português brasileiro, máximo 120 caracteres, apetitoso e com call-to-action direto",
  "headline": "título em português, máximo 38 caracteres, chamativo e direto"
}

Seja criativo, desperte desejo pelo prato e use call-to-action. Emojis são permitidos.`;
}
