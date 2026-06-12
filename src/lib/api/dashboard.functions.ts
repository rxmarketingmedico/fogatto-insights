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
      .select("total, created_at, utm_source, utm_campaign, status")
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
      limit: z.number().default(200),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let query = supabase
      .from("orders")
      .select("*, customers(name, phone)")
      .eq("restaurant_id", data.restaurantId)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.from) query = query.gte("created_at", data.from);
    if (data.to)   query = query.lte("created_at", data.to);

    const { data: orders, error } = await query;
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
      date: z.string(),
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

export const deleteAdSpend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("ad_spend").delete().eq("id", data.id);
    if (error) throw error;
    return { success: true };
  });

export const getCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string().uuid(),
      limit: z.number().default(100),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: customers, error } = await supabase
      .from("customers")
      .select("*")
      .eq("restaurant_id", data.restaurantId)
      .order("first_seen_at", { ascending: false })
      .limit(data.limit);

    if (error) throw error;
    return customers;
  });

export const getCampaignRoas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string().uuid(),
      from: z.string().optional(),
      to: z.string().optional(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [{ data: campaigns }, { data: spends }, ordersRes] = await Promise.all([
      supabase.from("campaigns").select("id, name, platform, utm_campaign, status, meta_ad_id, meta_status, meta_impressions, meta_clicks, meta_last_synced_at").eq("restaurant_id", data.restaurantId),
      supabase.from("ad_spend").select("campaign_id, amount").eq("restaurant_id", data.restaurantId),
      (() => {
        let q = supabase
          .from("orders")
          .select("utm_campaign, total")
          .eq("restaurant_id", data.restaurantId);
        if (data.from) q = q.gte("created_at", data.from);
        if (data.to) q = q.lte("created_at", data.to);
        return q;
      })(),
    ]);

    if (!campaigns) return [];

    const spendByCampaignId = (spends ?? []).reduce<Record<string, number>>((acc, s) => {
      acc[s.campaign_id] = (acc[s.campaign_id] ?? 0) + Number(s.amount);
      return acc;
    }, {});

    const revByUtmCampaign = (ordersRes.data ?? []).reduce<Record<string, number>>((acc, o) => {
      const key = o.utm_campaign ?? "__none__";
      acc[key] = (acc[key] ?? 0) + Number(o.total);
      return acc;
    }, {});

    return campaigns.map(c => {
      const spend = spendByCampaignId[c.id] ?? 0;
      const revenue = revByUtmCampaign[c.utm_campaign] ?? 0;
      const roas = spend > 0 ? revenue / spend : null;
      return { ...c, spend, revenue, roas };
    });
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      orderId: z.string().uuid(),
      restaurantId: z.string().uuid(),
      status: z.enum(["paid", "queued", "canceled"]),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("orders")
      .update({ status: data.status })
      .eq("id", data.orderId)
      .eq("restaurant_id", data.restaurantId);
    if (error) throw error;
    return { success: true };
  });

export const getIfoodClicks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({ restaurantId: z.string().uuid() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: clicks, error } = await supabase
      .from("link_clicks")
      .select("campaign_id")
      .eq("restaurant_id", data.restaurantId);

    if (error) throw error;

    return (clicks ?? []).reduce<Record<string, number>>((acc, row) => {
      const key = row.campaign_id ?? "__none__";
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  });
