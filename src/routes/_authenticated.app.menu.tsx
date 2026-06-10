import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getRestaurant, getMenuItems, upsertMenuItem, deleteMenuItem } from "@/lib/api/restaurant.functions";
import { Plus, Trash2, Edit2, Camera } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/menu")({
  component: MenuManagementPage,
});

function MenuManagementPage() {
  const fetchRestaurant = useServerFn(getRestaurant);
  const fetchItems = useServerFn(getMenuItems);
  const saveItem = useServerFn(upsertMenuItem);
  const removeItem = useServerFn(deleteMenuItem);
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  const { data: items, isLoading } = useQuery({
    queryKey: ["menu-items", restaurant?.id],
    queryFn: () => fetchItems({ data: { restaurantId: restaurant!.id } }),
    enabled: !!restaurant?.id,
  });

  const upsertMutation = useMutation({
    mutationFn: (data: any) => saveItem({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      setIsEditing(false);
      setEditingItem(null);
      toast.success("Item salvo com sucesso!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => removeItem({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast.success("Item removido.");
    },
  });

  if (!restaurant && !isLoading) return <div className="p-8">Restaurante não encontrado. Configure-o primeiro.</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cardápio</h1>
          <p className="text-muted-foreground mt-1">Gerencie os itens que seus clientes verão.</p>
        </div>
        <button 
          onClick={() => {
            setEditingItem({ restaurant_id: restaurant?.id, name: "", price: 0, description: "", active: true, position: items?.length || 0 });
            setIsEditing(true);
          }}
          className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium shadow-sm hover:opacity-90"
        >
          <Plus size={20} />
          Novo Item
        </button>
      </div>

      {isLoading ? (
        <div>Carregando itens...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items?.map(item => (
            <div key={item.id} className="border rounded-xl bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {item.photo_url ? (
                <img src={item.photo_url} alt={item.name} className="w-full h-40 object-cover" />
              ) : (
                <div className="w-full h-40 bg-muted flex items-center justify-center text-muted-foreground">
                   <Camera size={32} />
                </div>
              )}
              <div className="p-4">
                <div className="flex justify-between items-start mb-2">
                   <h3 className="font-bold text-lg leading-tight">{item.name}</h3>
                   <span className="font-bold text-primary">R$ {Number(item.price).toFixed(2)}</span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 h-10 mb-4">{item.description}</p>
                <div className="flex justify-between items-center border-t pt-4">
                   <span className={`text-xs px-2 py-1 rounded-full font-medium ${item.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {item.active ? 'Ativo' : 'Inativo'}
                   </span>
                   <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setEditingItem(item);
                          setIsEditing(true);
                        }}
                        className="p-2 hover:bg-accent rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 size={18} />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm("Deseja realmente excluir este item?")) deleteMutation.mutate(item.id);
                        }}
                        className="p-2 hover:bg-destructive/10 rounded-md text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 size={18} />
                      </button>
                   </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {isEditing && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
           <div className="bg-card w-full max-w-lg border rounded-xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
              <form onSubmit={(e) => {
                e.preventDefault();
                upsertMutation.mutate(editingItem);
              }} className="p-6 space-y-4">
                 <h2 className="text-xl font-bold">{editingItem.id ? 'Editar Item' : 'Novo Item'}</h2>
                 
                 <div className="space-y-2">
                    <label className="text-sm font-medium">Nome</label>
                    <input 
                      required
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={editingItem.name}
                      onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                    />
                 </div>

                 <div className="space-y-2">
                    <label className="text-sm font-medium">Descrição</label>
                    <textarea 
                      rows={3}
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={editingItem.description || ""}
                      onChange={e => setEditingItem({...editingItem, description: e.target.value})}
                    />
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Preço (R$)</label>
                      <input 
                        type="number"
                        step="0.01"
                        required
                        className="w-full rounded-md border bg-background px-3 py-2"
                        value={editingItem.price}
                        onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value)})}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Posição</label>
                      <input 
                        type="number"
                        className="w-full rounded-md border bg-background px-3 py-2"
                        value={editingItem.position}
                        onChange={e => setEditingItem({...editingItem, position: parseInt(e.target.value)})}
                      />
                    </div>
                 </div>

                 <div className="space-y-2">
                    <label className="text-sm font-medium">URL da Foto</label>
                    <input 
                      className="w-full rounded-md border bg-background px-3 py-2"
                      value={editingItem.photo_url || ""}
                      onChange={e => setEditingItem({...editingItem, photo_url: e.target.value})}
                      placeholder="https://..."
                    />
                 </div>

                 <div className="flex items-center gap-2">
                    <input 
                      type="checkbox"
                      id="active-check"
                      checked={editingItem.active}
                      onChange={e => setEditingItem({...editingItem, active: e.target.checked})}
                    />
                    <label htmlFor="active-check" className="text-sm font-medium">Item Ativo (visível no cardápio)</label>
                 </div>

                 <div className="flex justify-end gap-3 mt-6">
                    <button 
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 text-sm font-medium hover:bg-accent rounded-md"
                    >
                      Cancelar
                    </button>
                    <button 
                      disabled={upsertMutation.isPending}
                      className="px-6 py-2 bg-primary text-primary-foreground rounded-md font-medium hover:opacity-90 disabled:opacity-50"
                    >
                      {upsertMutation.isPending ? "Salvando..." : "Salvar"}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
}
