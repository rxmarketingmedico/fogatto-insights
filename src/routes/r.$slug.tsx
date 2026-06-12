import { createFileRoute } from "@tanstack/react-router";
import { getPublicRestaurantData, createOrder } from "@/lib/api/public.functions";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/r/$slug")({
  component: PublicMenuPage,
});

function PublicMenuPage() {
  const { slug } = Route.useParams();
  const fetchMenu = useServerFn(getPublicRestaurantData);
  const placeOrder = useServerFn(createOrder);
  
  const [cart, setCart] = useState<Record<string, number>>({});
  const [showCheckout, setShowCheckout] = useState(false);
  const [customer, setCustomer] = useState({ name: "", phone: "" });

  const { data: menuData, isLoading } = useQuery({
    queryKey: ["public-menu", slug],
    queryFn: () => fetchMenu({ data: slug }),
  });

  // Atribuição (UTM tracking)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utms = {
      utm_source: params.get("utm_source"),
      utm_medium: params.get("utm_medium"),
      utm_campaign: params.get("utm_campaign"),
      utm_content: params.get("utm_content"),
      fbclid: params.get("fbclid"),
    };

    const hasAnyUtm = Object.values(utms).some(v => v !== null);
    if (hasAnyUtm) {
      const stored = localStorage.getItem("fogatto_attribution_v1");
      if (!stored) {
        localStorage.setItem("fogatto_attribution_v1", JSON.stringify({
          ...utms,
          first_touch_at: new Date().toISOString()
        }));
      }
    }
  }, []);

  const addToCart = (itemId: string) => {
    setCart(prev => ({ ...prev, [itemId]: (prev[itemId] || 0) + 1 }));
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => {
      const next = { ...prev };
      if (next[itemId] > 1) next[itemId]--;
      else delete next[itemId];
      return next;
    });
  };

  const cartItemsCount = Object.values(cart).reduce((a, b) => a + b, 0);
  
  const orderMutation = useMutation({
    mutationFn: (data: any) => placeOrder({ data }),
    onSuccess: (data) => {
      window.location.href = data.whatsappUrl;
    },
    onError: (err) => alert(err.message)
  });

  if (isLoading) return <div className="flex min-h-screen items-center justify-center">Carregando cardápio...</div>;
  if (!menuData) return <div className="flex min-h-screen items-center justify-center">Restaurante não encontrado.</div>;

  const { restaurant, items } = menuData;

  const handleCheckout = (e: React.FormEvent) => {
    e.preventDefault();
    const storedAttribution = JSON.parse(localStorage.getItem("fogatto_attribution_v1") || "{}");
    
    orderMutation.mutate({
      slug,
      customer,
      items: Object.entries(cart).map(([menu_item_id, quantity]) => ({ menu_item_id, quantity })),
      attribution: storedAttribution
    });
  };

  return (
    <div className="mx-auto max-w-lg bg-background min-h-screen pb-24">
      <header className="p-6 text-center border-b">
        {restaurant.logo_url && <img src={restaurant.logo_url} alt={restaurant.name} className="mx-auto w-20 h-20 rounded-full object-cover mb-4 shadow-sm" />}
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">Peça agora pelo WhatsApp</p>
      </header>

      <main className="p-4 space-y-6">
        {items?.map(item => (
          <div key={item.id} className="border rounded-xl bg-card shadow-sm overflow-hidden">
            {item.video_url && (
              <video
                src={item.video_url}
                controls
                playsInline
                preload="metadata"
                className="w-full max-h-64 object-cover bg-black"
                poster={item.photo_url ?? undefined}
              />
            )}
            <div className="flex gap-4 p-3">
            {!item.video_url && item.photo_url && <img src={item.photo_url} alt={item.name} className="w-24 h-24 rounded-lg object-cover flex-shrink-0" />}
            <div className="flex-grow">
              <h3 className="font-bold text-lg">{item.name}</h3>
              <p className="text-sm text-muted-foreground line-clamp-2">{item.description}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold text-primary">R$ {Number(item.price).toFixed(2)}</span>
                <div className="flex items-center gap-3">
                   {cart[item.id] > 0 && (
                     <>
                        <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 rounded-full border flex items-center justify-center font-bold">-</button>
                        <span className="font-medium">{cart[item.id]}</span>
                     </>
                   )}
                   <button onClick={() => addToCart(item.id)} className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">+</button>
                </div>
              </div>
            </div>
            </div>
          </div>
        ))}
      </main>

      {cartItemsCount > 0 && !showCheckout && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-md px-4 animate-in slide-in-from-bottom-4 duration-300">
          <button 
            onClick={() => setShowCheckout(true)}
            className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold shadow-lg flex justify-between px-6 items-center"
          >
            <span>Ver Carrinho ({cartItemsCount})</span>
            <span className="text-lg">R$ {Object.entries(cart).reduce((sum, [id, q]) => {
              const item = items?.find(i => i.id === id);
              return sum + (Number(item?.price || 0) * q);
            }, 0).toFixed(2)}</span>
          </button>
        </div>
      )}


      {showCheckout && (
        <div className="fixed inset-0 bg-background/95 z-50 p-6 flex flex-col">
          <button onClick={() => setShowCheckout(false)} className="self-start text-primary font-bold mb-8">← Voltar para o cardápio</button>
          <h2 className="text-2xl font-bold mb-6">Finalizar Pedido</h2>
          
          <form onSubmit={handleCheckout} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Seu Nome</label>
              <input 
                required
                className="w-full rounded-md border p-3"
                value={customer.name}
                onChange={e => setCustomer({...customer, name: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">WhatsApp (com DDD)</label>
              <input 
                required
                type="tel"
                placeholder="Ex: 11999999999"
                className="w-full rounded-md border p-3"
                value={customer.phone}
                onChange={e => setCustomer({...customer, phone: e.target.value.replace(/\D/g, '')})}
              />
            </div>

            <div className="border-t pt-4">
               <div className="flex justify-between font-bold text-xl mb-6">
                  <span>Total do Pedido</span>
                  <span>R$ {Object.entries(cart).reduce((sum, [id, q]) => {
                    const item = items?.find(i => i.id === id);
                    return sum + (Number(item?.price || 0) * q);
                  }, 0).toFixed(2)}</span>
               </div>
               
               <button 
                disabled={orderMutation.isPending}
                className="w-full bg-primary text-primary-foreground py-4 rounded-xl font-bold shadow-lg disabled:opacity-50"
               >
                {orderMutation.isPending ? "Processando..." : "Confirmar e Enviar pelo WhatsApp"}
               </button>
               <p className="text-center text-xs text-muted-foreground mt-4">
                 Você será redirecionado para o WhatsApp do restaurante para finalizar.
               </p>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
