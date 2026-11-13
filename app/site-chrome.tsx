"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import SiteFooter from "./site-footer";
import { createSupabaseBrowserClient } from "./lib/supabase/browser";
import SiteAnalytics from "./site-analytics";
import WhatsAppHelp from "./whatsapp-help";

export default function SiteChrome() {
  const pathname = usePathname();
  const router = useRouter();
  const [callbackError, setCallbackError] = useState("");

  useEffect(() => {
    if (pathname !== "/") return;
    let active = true;

    async function handleAuthCallback() {
      const query = new URLSearchParams(window.location.search);
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = query.get("code");
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const authError =
        query.get("error_description") ?? hash.get("error_description");
      if (!code && !(accessToken && refreshToken) && !authError) return;

      const clearCallbackUrl = () => {
        window.history.replaceState({}, "", window.location.pathname);
      };

      if (authError) {
        clearCallbackUrl();
        setCallbackError(
          "Não foi possível validar o link. Gere um novo link de acesso e tente novamente.",
        );
        return;
      }

      try {
        const auth = createSupabaseBrowserClient().auth;
        const { error } = code
          ? await auth.exchangeCodeForSession(code)
          : await auth.setSession({
              access_token: accessToken!,
              refresh_token: refreshToken!,
            });
        if (!active) return;
        clearCallbackUrl();
        if (error) {
          setCallbackError(
            "Este link expirou ou já foi usado. Gere um novo link de acesso e tente novamente.",
          );
          return;
        }
        router.replace("/backoffice/definir-senha");
      } catch {
        if (!active) return;
        clearCallbackUrl();
        setCallbackError(
          "Não foi possível validar o link. Verifique a ligação e tente novamente.",
        );
      }
    }

    void handleAuthCallback();

    return () => {
      active = false;
    };
  }, [pathname, router]);

  if (pathname.startsWith("/backoffice")) return null;

  return (
    <>
      <SiteAnalytics />
      {callbackError ? (
        <p
          className="fixed inset-x-4 top-4 z-[100] mx-auto max-w-xl rounded-2xl bg-red-50 px-5 py-4 text-sm text-red-800 shadow-lg"
          role="alert"
        >
          {callbackError}
        </p>
      ) : null}
      <WhatsAppHelp />
      <SiteFooter />
    </>
  );
}
