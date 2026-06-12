import { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { chatWithCopilot } from "@/lib/api/copilot.functions";
import { getRestaurant } from "@/lib/api/restaurant.functions";
import { Bot, Send, X, Sparkles, RotateCcw } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Como estão meus resultados este mês?",
  "Quero criar uma campanha de promoção",
  "Qual campanha está dando mais ROAS?",
  "Mostre os últimos pedidos pendentes",
];

function renderMessage(text: string) {
  // Basic markdown: **bold**, newlines, bullet points
  const lines = text.split("\n");
  return lines.map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j}>{part}</strong> : part
    );
    if (line.startsWith("* ") || line.startsWith("- ")) {
      return <li key={i} className="ml-4 list-disc">{rendered.map((p, j) => j % 2 === 1 ? p : (p as string).slice(j === 0 ? 2 : 0))}</li>;
    }
    if (line.startsWith("# ")) {
      return <p key={i} className="font-bold text-sm mt-2">{rendered}</p>;
    }
    return <p key={i} className={line === "" ? "h-2" : ""}>{rendered}</p>;
  });
}

export function CopilotChat({ open, onClose }: { open: boolean; onClose: () => void }) {
  const chat = useServerFn(chatWithCopilot);
  const fetchRestaurant = useServerFn(getRestaurant);
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { data: restaurant } = useQuery({
    queryKey: ["restaurant"],
    queryFn: () => fetchRestaurant(),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading || !restaurant?.id) return;

    const newMessages: Message[] = [...messages, { role: "user", content }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const result = await chat({
        data: {
          restaurantId: restaurant.id,
          messages: newMessages,
        },
      });

      setMessages(prev => [...prev, { role: "assistant", content: result.message }]);

      // Invalidate queries if copilot created something
      if (result.actions?.some((a: any) => a.type === "campaign_created")) {
        queryClient.invalidateQueries({ queryKey: ["campaigns"] });
        queryClient.invalidateQueries({ queryKey: ["campaign-roas"] });
      }
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: `Desculpe, ocorreu um erro: ${e.message}`,
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div
        className="fixed inset-0 bg-black/20 z-40 md:hidden"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
        style={{
          width: 380,
          background: "var(--color-card)",
          borderLeft: "1px solid var(--color-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center gap-3 px-4 py-3 shrink-0"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "oklch(0.617 0.196 38.5 / 0.15)" }}
          >
            <Bot size={16} style={{ color: "oklch(0.617 0.196 38.5)" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">Fogatto Copilot</p>
            <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              {restaurant?.name ?? "Assistente IA"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="p-1.5 rounded-md hover:bg-accent transition-colors"
                title="Limpar conversa"
                style={{ color: "var(--color-muted-foreground)" }}
              >
                <RotateCcw size={14} />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-accent transition-colors"
              style={{ color: "var(--color-muted-foreground)" }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="space-y-4">
              {/* Welcome */}
              <div className="text-center pt-4">
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3"
                  style={{ background: "oklch(0.617 0.196 38.5 / 0.12)" }}
                >
                  <Sparkles size={22} style={{ color: "oklch(0.617 0.196 38.5)" }} />
                </div>
                <p className="font-semibold text-sm">Olá! Sou o Copilot do Fogatto.</p>
                <p className="text-xs mt-1" style={{ color: "var(--color-muted-foreground)" }}>
                  Posso analisar seus dados, criar campanhas e responder qualquer dúvida sobre seu negócio.
                </p>
              </div>

              {/* Suggestion chips */}
              <div className="grid grid-cols-1 gap-2 pt-2">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left px-3 py-2.5 rounded-xl border text-xs font-medium transition-colors hover:bg-accent"
                    style={{
                      borderColor: "var(--color-border)",
                      color: "var(--color-foreground)",
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1 mr-2"
                  style={{ background: "oklch(0.617 0.196 38.5 / 0.12)" }}
                >
                  <Bot size={12} style={{ color: "oklch(0.617 0.196 38.5)" }} />
                </div>
              )}
              <div
                className={`max-w-[82%] px-3 py-2.5 rounded-xl text-xs leading-relaxed space-y-0.5 ${
                  msg.role === "user"
                    ? "rounded-br-sm"
                    : "rounded-bl-sm"
                }`}
                style={{
                  background: msg.role === "user"
                    ? "oklch(0.617 0.196 38.5)"
                    : "var(--color-muted)",
                  color: msg.role === "user"
                    ? "white"
                    : "var(--color-foreground)",
                }}
              >
                {renderMessage(msg.content)}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div
                className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-1 mr-2"
                style={{ background: "oklch(0.617 0.196 38.5 / 0.12)" }}
              >
                <Bot size={12} style={{ color: "oklch(0.617 0.196 38.5)" }} />
              </div>
              <div
                className="px-3 py-3 rounded-xl rounded-bl-sm flex items-center gap-1"
                style={{ background: "var(--color-muted)" }}
              >
                {[0, 1, 2].map(d => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{
                      background: "var(--color-muted-foreground)",
                      animationDelay: `${d * 150}ms`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div
          className="shrink-0 p-3"
          style={{ borderTop: "1px solid var(--color-border)" }}
        >
          <div
            className="flex items-end gap-2 rounded-xl px-3 py-2"
            style={{ background: "var(--color-muted)", border: "1px solid var(--color-border)" }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Pergunte qualquer coisa… (Enter para enviar)"
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none leading-relaxed"
              style={{
                color: "var(--color-foreground)",
                maxHeight: 120,
                fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
              }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              disabled={loading || !restaurant}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading || !restaurant}
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
              style={{
                background: input.trim() ? "oklch(0.617 0.196 38.5)" : "transparent",
                color: input.trim() ? "white" : "var(--color-muted-foreground)",
              }}
            >
              <Send size={13} />
            </button>
          </div>
          <p className="text-[10px] text-center mt-1.5" style={{ color: "var(--color-muted-foreground)" }}>
            Shift+Enter para nova linha · Enter para enviar
          </p>
        </div>
      </div>
    </>
  );
}
