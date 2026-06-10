import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { handleMetaCallback } from "@/lib/api/meta-ads.functions";
import { toast } from "sonner";

export const Route = createFileRoute(
  "/_authenticated/app/settings/meta-callback",
)({
  component: MetaCallbackPage,
});

function MetaCallbackPage() {
  const { code, state } = Route.useSearch() as { code?: string; state?: string };
  const processCallback = useServerFn(handleMetaCallback);

  useEffect(() => {
    async function handle() {
      // Check for error in URL (common if user cancels or there's a config issue)
      const urlParams = new URLSearchParams(window.location.search);
      const error = urlParams.get("error");
      const errorDescription = urlParams.get("error_description");

      if (error) {
        localStorage.setItem(
          "meta_callback_result",
          JSON.stringify({ error: errorDescription || error }),
        );
        window.close();
        return;
      }

      if (code && state) {
        try {
          const result = await processCallback({ data: { code, state } });
          // Store result in localStorage so the main window can pick it up
          localStorage.setItem("meta_callback_result", JSON.stringify(result));
          window.close();
        } catch (error: any) {
          console.error(error);
          localStorage.setItem(
            "meta_callback_result",
            JSON.stringify({ error: error.message }),
          );
          window.close();
        }
      } else {
        window.close();
      }
    }
    handle();
  }, [code, state]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
        <p className="text-muted-foreground font-medium">Conectando sua conta Meta Ads...</p>
      </div>
    </div>
  );
}
