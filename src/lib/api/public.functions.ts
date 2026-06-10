import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const orderInputSchema = z.object({
  slug: z.string(),
  customer: z.object({
    name: z.string().min(1),
    phone: z.string().min(10),
  }),
  items: z.array(z.object({
    menu_item_id: z.string().uuid(),
    quantity: z.number().min(1),
  })),
  attribution: z.object({
    utm_source: z.string().optional().nullable(),
    utm_medium: z.string().optional().nullable(),
    utm_campaign: z.string().optional().nullable(),
    utm_content: z.string().optional().nullable(),
    fbclid: z.string().optional().nullable(),
    first_touch_at: z.string().optional().nullable(),
  }),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: any) => orderInputSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    // 1. Get restaurant
    const { data: restaurant, error: rError } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, whatsapp_number")
      .eq("slug", data.slug)
      .single();
      
    if (rError || !restaurant) throw new Error("Restaurante não encontrado");

    // 2. Upsert customer (dedupe by phone within restaurant)
    const { data: customer, error: cError } = await supabaseAdmin
      .from("customers")
      .upsert({
        restaurant_id: restaurant.id,
        phone: data.customer.phone,
        name: data.customer.name,
        first_utm_source: data.attribution.utm_source,
        first_utm_campaign: data.attribution.utm_campaign,
        first_seen_at: data.attribution.first_touch_at || new Date().toISOString(),
      }, { onConflict: "restaurant_id, phone" })
      .select()
      .single();

    if (cError) throw cError;

    // 3. Get actual prices from menu items (security: don't trust client prices)
    const itemIds = data.items.map(i => i.menu_item_id);
    const { data: menuItems, error: mError } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price")
      .in("id", itemIds);

    if (mError) throw mError;

    let total = 0;
    const orderItems = data.items.map(cartItem => {
      const menuItem = menuItems.find(m => m.id === cartItem.menu_item_id);
      if (!menuItem) throw new Error(`Item ${cartItem.menu_item_id} não encontrado`);
      const itemTotal = Number(menuItem.price) * cartItem.quantity;
      total += itemTotal;
      return {
        menu_item_id: menuItem.id,
        item_name: menuItem.name,
        unit_price: menuItem.price,
        quantity: cartItem.quantity
      };
    });

    // 4. Create Order
    const orderCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: order, error: oError } = await supabaseAdmin
      .from("orders")
      .insert({
        restaurant_id: restaurant.id,
        customer_id: customer.id,
        total,
        order_code: orderCode,
        ...data.attribution
      })
      .select()
      .single();

    if (oError) throw oError;

    // 5. Create Order Items
    const { error: oiError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems.map(oi => ({ ...oi, order_id: order.id })));

    if (oiError) throw oiError;

    // 6. Generate WhatsApp URL
    const itemsText = orderItems.map(oi => `${oi.quantity}x ${oi.item_name} - R$ ${(Number(oi.unit_price) * oi.quantity).toFixed(2)}`).join('\n');
    const message = `*Novo Pedido no Fogatto!* 📝\n\n*Código:* #${orderCode}\n*Cliente:* ${data.customer.name}\n*Telefone:* ${data.customer.phone}\n\n*Itens:*\n${itemsText}\n\n*Total:* R$ ${total.toFixed(2)}\n\n_Pedido rastreado via Fogatto_`;
    
    const whatsappUrl = `https://wa.me/${restaurant.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

    return {
      orderCode,
      whatsappUrl,
      orderId: order.id
    };
  });

export const getPublicRestaurantData = createServerFn({ method: "GET" })
  .inputValidator((slug: string) => z.string().parse(slug))
  .handler(async ({ data: slug }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    
    const { data: restaurant, error: rError } = await supabaseAdmin
      .from("restaurants")
      .select("id, name, slug, logo_url, whatsapp_number")
      .eq("slug", slug)
      .single();

    if (rError || !restaurant) return null;

    const { data: items, error: mError } = await supabaseAdmin
      .from("menu_items")
      .select("*")
      .eq("restaurant_id", restaurant.id)
      .eq("active", true)
      .order("position", { ascending: true });

    if (mError) throw mError;

    return {
      restaurant,
      items
    };
  });
