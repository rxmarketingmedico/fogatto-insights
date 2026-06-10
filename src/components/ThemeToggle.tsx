import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggle}
      title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
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
        fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
        fontSize: 14,
        fontWeight: 500,
        color: "var(--color-muted-foreground, #9D9182)",
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
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{isDark ? "Modo claro" : "Modo escuro"}</span>
    </button>
  );
}
