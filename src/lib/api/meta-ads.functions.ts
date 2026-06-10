import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const META_VERSION = "v21.0";
const META_AUTH_URL = `https://www.facebook.com/${META_VERSION}/dialog/oauth`;
const META_GRAPH_URL = `https://graph.facebook.com/${META_VERSION}`;
const META_APP_ID_FALLBACK = "1676842143509066";

export const getMetaAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ restaurantId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const clientId = process.env.META_APP_ID || META_APP_ID_FALLBACK;
    const redirectUri = "https://fogatto.lovable.app/meta-callback";

    if (!clientId) throw new Error("META_APP_ID não configurado.");

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "ads_management,ads_read,pages_read_engagement,pages_show_list",
      response_type: "code",
      state: data.restaurantId,
    });

    return { url: `${META_AUTH_URL}?${params.toString()}` };
  });

export const handleMetaCallback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      code: z.string(),
      state: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const clientId = process.env.META_APP_ID || META_APP_ID_FALLBACK;
    const clientSecret = process.env.META_APP_SECRET;
    const redirectUri = "https://fogatto.lovable.app/meta-callback";

    if (!clientId || !clientSecret) throw new Error("Meta Ads não configurado no servidor.");

    // 1. Exchange code for short-lived token
    const tokenResponse = await fetch(`${META_GRAPH_URL}/oauth/access_token?` + new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      code: data.code,
    }));

    const tokenData = await tokenResponse.json();
    if (tokenData.error) throw new Error(tokenData.error.message);

    // 2. Exchange for long-lived token
    const longLivedResponse = await fetch(`${META_GRAPH_URL}/oauth/access_token?` + new URLSearchParams({
      grant_type: "fb_exchange_token",
      client_id: clientId,
      client_secret: clientSecret,
      fb_exchange_token: tokenData.access_token,
    }));

    const longLivedData = await longLivedResponse.json();
    if (longLivedData.error) throw new Error(longLivedData.error.message);
    const accessToken = longLivedData.access_token;

    // 3. Fetch Ad Accounts
    const adAccountsResponse = await fetch(`${META_GRAPH_URL}/me/adaccounts?` + new URLSearchParams({
      fields: "id,name,account_status",
      access_token: accessToken,
    }));
    const adAccountsData = await adAccountsResponse.json();

    // 4. Fetch Pages
    const pagesResponse = await fetch(`${META_GRAPH_URL}/me/accounts?` + new URLSearchParams({
      fields: "id,name,access_token",
      access_token: accessToken,
    }));
    const pagesData = await pagesResponse.json();

    // 5. Update restaurant with access token
    const { error: updateError } = await supabase
      .from("restaurants")
      .update({
        meta_access_token: accessToken,
        meta_connected_at: new Date().toISOString(),
      })
      .eq("id", data.state);

    if (updateError) throw updateError;

    return {
      adAccounts: adAccountsData.data || [],
      pages: pagesData.data || [],
    };
  });

export const connectMetaAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string(),
      adAccountId: z.string(),
      pageId: z.string(),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("restaurants")
      .update({
        meta_ad_account_id: data.adAccountId,
        meta_page_id: data.pageId,
      })
      .eq("id", data.restaurantId);

    if (error) throw error;
    return { success: true };
  });

export const disconnectMetaAds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ restaurantId: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { error } = await supabase
      .from("restaurants")
      .update({
        meta_access_token: null,
        meta_ad_account_id: null,
        meta_page_id: null,
        meta_connected_at: null,
      })
      .eq("id", data.restaurantId);

    if (error) throw error;
    return { success: true };
  });

export const searchMetaLocations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      restaurantId: z.string(),
      query: z.string().min(2),
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("meta_access_token")
      .eq("id", data.restaurantId)
      .single();

    if (!restaurant?.meta_access_token) return [];

    const res = await fetch(`${META_GRAPH_URL}/search?` + new URLSearchParams({
      type: "adgeolocation",
      q: data.query,
      location_types: "city",
      country_code: "BR",
      access_token: restaurant.meta_access_token,
    }));
    const result = await res.json();
    if (result.error) return [];

    return (result.data || []).slice(0, 8).map((loc: any) => ({
      key: String(loc.key),
      name: loc.name,
      region: loc.region || "",
    }));
  });

export const syncMetaInsights = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({ restaurantId: z.string() }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: restaurant } = await supabase
      .from("restaurants")
      .select("meta_access_token, meta_ad_account_id")
      .eq("id", data.restaurantId)
      .single();

    if (!restaurant?.meta_access_token) throw new Error("Meta não conectado.");

    const { data: campaigns } = await supabase
      .from("campaigns")
      .select("id, meta_campaign_id")
      .eq("restaurant_id", data.restaurantId)
      .not("meta_campaign_id", "is", null);

    if (!campaigns || campaigns.length === 0) {
      return { synced: 0, totalSpend: 0, totalImpressions: 0 };
    }

    let totalSpend = 0;
    let totalImpressions = 0;
    let synced = 0;

    for (const campaign of campaigns) {
      const insightsRes = await fetch(
        `${META_GRAPH_URL}/${campaign.meta_campaign_id}/insights?` +
          new URLSearchParams({
            fields: "spend,impressions,clicks,reach",
            date_preset: "last_90d",
            time_increment: "1",
            limit: "100",
            access_token: restaurant.meta_access_token,
          })
      );
      const insightsData = await insightsRes.json();
      if (insightsData.error) continue;

      const rows: Array<{ date_start: string; spend: string; impressions: string; clicks: string; reach: string }> =
        insightsData.data || [];

      // Aggregate totals for campaign columns
      const aggSpend = rows.reduce((s, r) => s + parseFloat(r.spend || "0"), 0);
      const aggImpressions = rows.reduce((s, r) => s + parseInt(r.impressions || "0"), 0);
      const aggClicks = rows.reduce((s, r) => s + parseInt(r.clicks || "0"), 0);
      const aggReach = rows.reduce((s, r) => s + parseInt(r.reach || "0"), 0);

      // Remove old meta-synced spend records and re-insert fresh ones
      await supabase
        .from("ad_spend")
        .delete()
        .eq("campaign_id", campaign.id)
        .eq("source", "meta");

      const spendRows = rows
        .filter(r => parseFloat(r.spend || "0") > 0)
        .map(r => ({
          restaurant_id: data.restaurantId,
          campaign_id: campaign.id,
          date: r.date_start,
          amount: parseFloat(r.spend),
          source: "meta",
        }));

      if (spendRows.length > 0) {
        await supabase.from("ad_spend").insert(spendRows);
      }

      // Update campaign with aggregate metrics
      await supabase
        .from("campaigns")
        .update({
          meta_impressions: aggImpressions,
          meta_clicks: aggClicks,
          meta_reach: aggReach,
          meta_last_synced_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);

      totalSpend += aggSpend;
      totalImpressions += aggImpressions;
      synced++;
    }

    return { synced, totalSpend, totalImpressions };
  });

const OPTIMIZATION_GOAL: Record<string, string> = {
  OUTCOME_TRAFFIC: "LINK_CLICKS",
  OUTCOME_SALES: "LINK_CLICKS",
  OUTCOME_AWARENESS: "REACH",
  OUTCOME_ENGAGEMENT: "POST_ENGAGEMENT",
  OUTCOME_LEADS: "LEAD_GENERATION",
};

export const publishMetaAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) =>
    z.object({
      campaignId: z.string(),
      adData: z.object({
        imageUrl: z.string(),
        primaryText: z.string().max(125),
        headline: z.string().max(40),
        destinationUrl: z.string(),
        objective: z.enum(["OUTCOME_TRAFFIC", "OUTCOME_SALES", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_LEADS"]).default("OUTCOME_TRAFFIC"),
        budgetType: z.enum(["daily", "lifetime"]).default("daily"),
        budget: z.number().min(5),
        startDate: z.string(),
        endDate: z.string().optional().nullable(),
        ageMin: z.number().min(13).max(65).default(18),
        ageMax: z.number().min(13).max(65).default(65),
        genderIds: z.array(z.number()).optional(),
        locationKey: z.string().optional(),
        locationRadius: z.number().default(15),
      })
    }).parse(data)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // 1. Get restaurant and campaign data
    const { data: campaign } = await supabase
      .from("campaigns")
      .select("*, restaurants(*)")
      .eq("id", data.campaignId)
      .single();

    if (!campaign) throw new Error("Campanha não encontrada.");
    const restaurant = campaign.restaurants;
    const accessToken = restaurant.meta_access_token;
    const adAccountId = restaurant.meta_ad_account_id;
    const pageId = restaurant.meta_page_id;

    if (!accessToken || !adAccountId || !pageId) {
      throw new Error("Meta Ads não está totalmente configurado para este restaurante.");
    }

    // 2. Upload Image
    const imgRes = await fetch(data.adData.imageUrl);
    const imgBlob = await imgRes.blob();
    const arrayBuffer = await imgBlob.arrayBuffer();
    const base64Img = Buffer.from(arrayBuffer).toString('base64');

    const adImageRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/adimages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bytes: base64Img,
        access_token: accessToken,
      }),
    });
    const adImageData = await adImageRes.json() as any;
    if (adImageData.error) throw new Error(`Erro AdImage: ${adImageData.error.message}`);
    const imageEntry = Object.values(adImageData.images)[0] as any;
    const hash = imageEntry.hash;

    // 3. Create Campaign
    const metaCampaignRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaign.name,
        objective: data.adData.objective,
        status: "PAUSED",
        special_ad_categories: [],
        access_token: accessToken,
      }),
    });
    const metaCampaignData = await metaCampaignRes.json();
    if (metaCampaignData.error) throw new Error(`Erro Campaign: ${metaCampaignData.error.message}`);
    const metaCampaignId = metaCampaignData.id;

    // 4. Build targeting
    const targeting: any = {
      age_min: data.adData.ageMin ?? 18,
      age_max: data.adData.ageMax ?? 65,
      geo_locations: data.adData.locationKey
        ? {
            cities: [{
              key: data.adData.locationKey,
              radius: data.adData.locationRadius ?? 15,
              distance_unit: "kilometer",
            }],
          }
        : { countries: ["BR"] },
    };
    if (data.adData.genderIds && data.adData.genderIds.length > 0) {
      targeting.genders = data.adData.genderIds;
    }

    // 5. Create Ad Set
    const optimizationGoal = OPTIMIZATION_GOAL[data.adData.objective] ?? "LINK_CLICKS";
    const budgetField = data.adData.budgetType === "lifetime" ? "lifetime_budget" : "daily_budget";

    const adSetBody: any = {
      name: `${campaign.name} - Conjunto`,
      campaign_id: metaCampaignId,
      [budgetField]: Math.round(data.adData.budget * 100),
      billing_event: "IMPRESSIONS",
      optimization_goal: optimizationGoal,
      targeting,
      start_time: Math.floor(new Date(data.adData.startDate + "T00:00:00").getTime() / 1000),
      status: "PAUSED",
      access_token: accessToken,
    };
    if (data.adData.endDate) {
      adSetBody.end_time = Math.floor(new Date(data.adData.endDate + "T23:59:59").getTime() / 1000);
    }

    const adSetRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adSetBody),
    });
    const adSetData = await adSetRes.json();
    if (adSetData.error) throw new Error(`Erro AdSet: ${adSetData.error.message}`);
    const metaAdSetId = adSetData.id;

    // 6. Create Ad Creative
    const creativeRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/adcreatives`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${campaign.name} - Criativo`,
        object_story_spec: {
          page_id: pageId,
          link_data: {
            image_hash: hash,
            link: data.adData.destinationUrl,
            message: data.adData.primaryText,
            name: data.adData.headline,
          }
        },
        access_token: accessToken,
      }),
    });
    const creativeData = await creativeRes.json();
    if (creativeData.error) throw new Error(`Erro Creative: ${creativeData.error.message}`);
    const creativeId = creativeData.id;

    // 7. Create Ad
    const adRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/ads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${campaign.name} - Anúncio`,
        adset_id: metaAdSetId,
        creative: { creative_id: creativeId },
        status: "PAUSED",
        access_token: accessToken,
      }),
    });
    const adDataRes = await adRes.json();
    if (adDataRes.error) throw new Error(`Erro Ad: ${adDataRes.error.message}`);
    const metaAdId = adDataRes.id;

    // 8. Update Campaign in Database
    const { error: finalUpdateError } = await supabase
      .from("campaigns")
      .update({
        meta_campaign_id: metaCampaignId,
        meta_adset_id: metaAdSetId,
        meta_ad_id: metaAdId,
        meta_status: "paused",
        meta_published_at: new Date().toISOString(),
      })
      .eq("id", data.campaignId);

    if (finalUpdateError) throw finalUpdateError;

    return {
      success: true,
      metaAdId,
      adsManagerUrl: `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${adAccountId.replace('act_', '')}`,
    };
  });
