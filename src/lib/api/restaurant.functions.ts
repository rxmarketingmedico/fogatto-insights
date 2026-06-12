import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getRestaurant = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({ id: z.string().uuid().optional() }).optional().parse(data ?? {})
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let query = supabase
      .from("restaurants")
      .select("*")
      .eq("owner_id", userId);

    if (data?.id) {
      query = query.eq("id", data.id).limit(1);
    } else {
      query = query.order("created_at", { ascending: true }).limit(1);
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    return rows?.[0] ?? null;
  });

export const listRestaurants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("restaurants")
      .select("id, name, slug, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
  });

export const updateRestaurant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      name: z.string().min(1),
      slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
      whatsapp_number: z.string().min(10),
      logo_url: z.string().optional().nullable(),
      ifood_url: z.string().url().optional().nullable().or(z.literal("")),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    
    // Check if slug is taken by another restaurant
    const { data: existing } = await supabase
      .from("restaurants")
      .select("id")
      .eq("slug", data.slug)
      .neq("owner_id", userId)
      .maybeSingle();
      
    if (existing) throw new Error("Este endereço (slug) já está em uso.");

    const { data: restaurant, error } = await supabase
      .from("restaurants")
      .upsert({
        owner_id: userId,
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return restaurant;
  });

export const getMenuItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: items, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("position", { ascending: true });

    if (error) throw error;
    return items;
  });

export const upsertMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      id: z.string().uuid().optional(),
      restaurant_id: z.string().uuid(),
      name: z.string().min(1),
      description: z.string().optional().nullable(),
      price: z.number().min(0),
      photo_url: z.string().optional().nullable(),
      video_url: z.string().optional().nullable(),
      active: z.boolean().default(true),
      position: z.number().default(0),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: item, error } = await supabase
      .from("menu_items")
      .upsert({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return item;
  });

export const deleteMenuItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("menu_items")
      .delete()
      .eq("id", data.id);

    if (error) throw error;
    return { success: true };
  });
