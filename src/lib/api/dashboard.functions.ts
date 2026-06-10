import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => 
    z.object({ 
      restaurantId: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional()
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("orders")
      .select("total, created_at, utm_source, utm_campaign")
      .eq("restaurant_id", data.restaurantId);

    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);

    const { data: orders, error } = await query;
    if (error) throw error;

    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0);
    const totalOrders = orders.length;
    const avgTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    // Unique customers count - need to query customers table or count distinct in orders
    const { count: totalCustomers } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("restaurant_id", data.restaurantId);

    return {
      totalRevenue,
      totalOrders,
      avgTicket,
      totalCustomers: totalCustomers || 0,
      orders // return raw for more charts if needed
    };
  });

export const getOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => 
    z.object({ 
      restaurantId: z.string().uuid(),
      limit: z.number().default(50)
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (error) throw error;
    return orders;
  });

export const getCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaigns, error } = await supabase
      .from("campaigns")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return campaigns;
  });

export const upsertCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      id: z.string().uuid().optional(),
      restaurant_id: z.string().uuid(),
      name: z.string().min(1),
      platform: z.enum(["meta", "google", "outro"]),
      utm_campaign: z.string().min(1),
      status: z.string().default("active"),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: campaign, error } = await supabase
      .from("campaigns")
      .upsert({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return campaign;
  });

export const getAdSpend = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ restaurantId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: spends, error } = await supabase
      .from("ad_spend")
      .select("*, campaigns(name, utm_campaign)")
      .eq("restaurant_id", data.restaurantId)
      .order("date", { ascending: false });

    if (error) throw error;
    return spends;
  });

export const upsertAdSpend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      id: z.string().uuid().optional(),
      restaurant_id: z.string().uuid(),
      campaign_id: z.string().uuid(),
      date: z.string(), // YYYY-MM-DD
      amount: z.number().min(0),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: spend, error } = await supabase
      .from("ad_spend")
      .upsert(data)
      .select()
      .single();

    if (error) throw error;
    return spend;
  });
