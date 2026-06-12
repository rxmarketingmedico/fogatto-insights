import { createFileRoute, Outlet, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Utensils, Megaphone, Users, Settings, LogOut, ShoppingBag, Bot } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { FogattoLogo } from "@/components/FogattoLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { CopilotChat } from "@/components/CopilotChat";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

function AppLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copilotOpen, setCopilotOpen] = useState(false);

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="flex min-h-screen" style={{ background: "var(--color-background)", color: "var(--color-foreground)" }}>
      {/* Sidebar */}
      <aside
        className="w-60 hidden md:flex flex-col"
        style={{
          background: "var(--color-sidebar)",
          borderRight: "1px solid var(--color-sidebar-border)",
        }}
      >
        {/* Logo */}
        <div className="p-6" style={{ borderBottom: "1px solid var(--color-sidebar-border)" }}>
          <FogattoLogo size="md" />
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 flex flex-col gap-1">
          <NavItem to="/app" icon={<LayoutDashboard size={18} />} label="Visão Geral" exact />
          <NavItem to="/app/menu" icon={<Utensils size={18} />} label="Cardápio" />
          <NavItem to="/app/campaigns" icon={<Megaphone size={18} />} label="Campanhas" />
          <NavItem to="/app/orders" icon={<ShoppingBag size={18} />} label="Pedidos" />
          <NavItem to="/app/customers" icon={<Users size={18} />} label="Clientes" />
          <NavItem to="/app/settings" icon={<Settings size={18} />} label="Configurações" />
        </nav>

        {/* Copilot button */}
        <div className="px-3 pb-1">
          <button
            onClick={() => setCopilotOpen(o => !o)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: copilotOpen ? "1px solid oklch(0.617 0.196 38.5 / 0.4)" : "1px solid transparent",
              background: copilotOpen ? "oklch(0.617 0.196 38.5 / 0.12)" : "transparent",
              cursor: "pointer",
              color: copilotOpen ? "oklch(0.617 0.196 38.5)" : "var(--color-muted-foreground)",
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 600,
              transition: "all 140ms ease",
            }}
          >
            <Bot size={18} />
            <span>Copilot</span>
            <span style={{
              marginLeft: "auto",
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: "0.06em",
              padding: "1px 5px",
              borderRadius: 4,
              background: "oklch(0.617 0.196 38.5 / 0.15)",
              color: "oklch(0.617 0.196 38.5)",
            }}>IA</span>
          </button>
        </div>

        {/* Theme toggle + Sign out */}
        <div className="p-3 flex flex-col gap-1" style={{ borderTop: "1px solid var(--color-sidebar-border)" }}>
          <ThemeToggle />
          <button
            onClick={handleSignOut}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--color-muted-foreground)",
              fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              fontSize: 14,
              fontWeight: 500,
              transition: "all 140ms ease",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "var(--color-accent)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-foreground)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--color-muted-foreground)";
            }}
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header
          className="md:hidden flex items-center justify-between px-4 py-3"
          style={{
            background: "var(--color-sidebar)",
            borderBottom: "1px solid var(--color-sidebar-border)",
          }}
        >
          <FogattoLogo size="sm" />
        </header>

        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Copilot drawer */}
      <CopilotChat open={copilotOpen} onClose={() => setCopilotOpen(false)} />
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  exact,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  exact?: boolean;
}) {
  const { location } = useRouterState();
  const isActive = exact ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <Link
      to={to}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
        fontSize: 14,
        fontWeight: isActive ? 600 : 500,
        textDecoration: "none",
        transition: "all 140ms ease",
        background: isActive ? "oklch(0.617 0.196 38.5 / 0.12)" : "transparent",
        color: isActive ? "oklch(0.617 0.196 38.5)" : "var(--color-muted-foreground)",
        boxShadow: isActive ? "inset 0 0 0 1px oklch(0.617 0.196 38.5 / 0.2)" : "none",
      }}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
