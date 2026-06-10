import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const META_VERSION = "v21.0";
const META_AUTH_URL = `https://www.facebook.com/${META_VERSION}/dialog/oauth`;
const META_GRAPH_URL = `https://graph.facebook.com/${META_VERSION}`;

export const getMetaAuthUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: any) => z.object({ restaurantId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const clientId = process.env.META_APP_ID;
    const redirectUri = `${process.env.APP_URL_FOR_META || process.env.VITE_APP_URL}/app/settings/meta-callback`;
    
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
    const clientId = process.env.META_APP_ID;
    const clientSecret = process.env.META_APP_SECRET;
    const redirectUri = `${process.env.APP_URL_FOR_META || process.env.VITE_APP_URL}/app/settings/meta-callback`;

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
        dailyBudget: z.number().min(5),
        startDate: z.string(),
        endDate: z.string().optional().nullable(),
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
    // Note: In a real scenario, we might need to fetch the image from imageUrl and convert to base64 if it's not already.
    // Assuming imageUrl is a public URL for now, but Meta Ads API preferred base64 or bytes for /adimages.
    // For simplicity, we'll try to fetch the image first.
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
    const imageHash = Object.values(adImageData.images)[0] as any;
    const hash = imageHash.hash;

    // 3. Create Campaign
    const metaCampaignRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/campaigns`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: campaign.name,
        objective: "OUTCOME_TRAFFIC",
        status: "PAUSED",
        special_ad_categories: [],
        access_token: accessToken,
      }),
    });
    const metaCampaignData = await metaCampaignRes.json();
    if (metaCampaignData.error) throw new Error(`Erro Campaign: ${metaCampaignData.error.message}`);
    const metaCampaignId = metaCampaignData.id;

    // 4. Create Ad Set
    const adSetRes = await fetch(`${META_GRAPH_URL}/${adAccountId}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `${campaign.name} - Conjunto`,
        campaign_id: metaCampaignId,
        daily_budget: Math.round(data.adData.dailyBudget * 100),
        billing_event: "IMPRESSIONS",
        optimization_goal: "LINK_CLICKS",
        targeting: { geo_locations: { countries: ["BR"] } },
        start_time: data.adData.startDate,
        end_time: data.adData.endDate || undefined,
        status: "PAUSED",
        access_token: accessToken,
      }),
    });
    const adSetData = await adSetRes.json();
    if (adSetData.error) throw new Error(`Erro AdSet: ${adSetData.error.message}`);
    const metaAdSetId = adSetData.id;

    // 5. Create Ad Creative
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

    // 6. Create Ad
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

    // 7. Update Campaign in Database
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
