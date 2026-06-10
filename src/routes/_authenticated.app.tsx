import { createFileRoute, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Utensils, Megaphone, Users, Settings, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-card hidden md:flex flex-col">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold tracking-tight">Fogatto</h2>
        </div>
        <nav className="flex-1 p-4 space-y-2">
          <NavItem to="/app" icon={<LayoutDashboard size={20} />} label="Visão Geral" />
          <NavItem to="/app/menu" icon={<Utensils size={20} />} label="Cardápio" />
          <NavItem to="/app/campaigns" icon={<Megaphone size={20} />} label="Campanhas" />
          <NavItem to="/app/customers" icon={<Users size={20} />} label="Clientes" />
          <NavItem to="/app/settings" icon={<Settings size={20} />} label="Configurações" />
        </nav>
        <div className="p-4 border-t">
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
         {/* Mobile Header */}
         <header className="md:hidden border-b p-4 flex justify-between items-center bg-card">
            <h2 className="text-xl font-bold">Fogatto</h2>
            {/* Mobile menu trigger could go here */}
         </header>
         
         <main className="flex-1 overflow-y-auto">
            <Outlet />
         </main>
      </div>
    </div>
  );
}

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link 
      to={to} 
      activeProps={{ className: "bg-accent text-foreground" }}
      className="flex items-center gap-3 p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
}
