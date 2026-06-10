import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fogatto — Cresça sem depender de iFood" },
      { name: "description", content: "A plataforma de crescimento para restaurantes independentes brasileiros." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Fogatto</h1>
      <p className="mt-4 text-xl text-muted-foreground">
        Pare de depender de marketplaces. Conecte seus anúncios ao seu WhatsApp de forma rastreável.
      </p>
      <div className="mt-8 flex gap-4">
        <a href="/auth" className="rounded-lg bg-primary px-6 py-3 text-lg font-medium text-primary-foreground">
          Criar minha conta
        </a>
        <a href="/auth" className="rounded-lg border px-6 py-3 text-lg font-medium">
          Entrar
        </a>
      </div>
    </div>
  );
}
