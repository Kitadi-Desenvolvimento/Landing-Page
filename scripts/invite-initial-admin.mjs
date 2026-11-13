import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.BACKOFFICE_ADMIN_EMAIL?.trim().toLowerCase();
const localMode = process.argv.includes("--local");
const siteUrl = localMode
  ? "http://localhost:3000"
  : process.env.NEXT_PUBLIC_SITE_URL?.trim();

if (!supabaseUrl || !serviceRoleKey || !email || !siteUrl) {
  console.error(
    "Defina NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e BACKOFFICE_ADMIN_EMAIL no .env.local. NEXT_PUBLIC_SITE_URL também é necessário fora do modo local.",
  );
  process.exitCode = 1;
} else {
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const callbackUrl = new URL(localMode ? "/" : "/auth/callback", siteUrl);
  if (!localMode) {
    callbackUrl.searchParams.set("next", "/backoffice/definir-senha");
  }
  const generateLink = process.argv.includes("--link");
  let linkType = "invite";
  let result = generateLink
    ? await supabase.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: callbackUrl.toString() },
      })
    : await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: callbackUrl.toString(),
      });
  if (
    generateLink &&
    result.error &&
    ["email_exists", "user_already_exists"].includes(result.error.code ?? "")
  ) {
    linkType = "magiclink";
    result = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: callbackUrl.toString() },
    });
  }
  const { data, error } = result;

  if (error || !data.user) {
    console.error(
      generateLink
        ? "Não foi possível gerar o link de convite inicial."
        : "Não foi possível enviar o convite inicial.",
      error?.code ?? "missing_user",
    );
    process.exitCode = 1;
  } else {
    const { error: roleError } = await supabase.auth.admin.updateUserById(
      data.user.id,
      { app_metadata: { ...data.user.app_metadata, role: "admin" } },
    );

    if (roleError) {
      console.error(
        "O convite foi criado, mas não foi possível atribuir o papel de administrador.",
        roleError.code,
      );
      process.exitCode = 1;
    } else if (generateLink) {
      if (!data.properties.action_link) {
        console.error("O Supabase não devolveu o link de convite.");
        process.exitCode = 1;
      } else {
        const actionLink = new URL(data.properties.action_link);
        const effectiveRedirect = actionLink.searchParams.get("redirect_to");
        if (!effectiveRedirect) {
          console.error("O link gerado não contém um endereço de retorno.");
          process.exitCode = 1;
        } else {
          const actualRedirect = new URL(effectiveRedirect);
          if (
            actualRedirect.origin !== callbackUrl.origin ||
            actualRedirect.pathname !== callbackUrl.pathname
          ) {
            console.error(
              `O Supabase redirecionaria para ${actualRedirect.origin}${actualRedirect.pathname} em vez de ${callbackUrl.origin}${callbackUrl.pathname}. Adicione o endereço de callback aos Redirect URLs em Authentication > URL Configuration e gere um novo link.`,
            );
            process.exitCode = 1;
          } else {
            console.log(
              `Link de ${linkType === "invite" ? "convite" : "acesso"} de uso único:`,
            );
            console.log(data.properties.action_link);
          }
        }
      }
    } else {
      console.log("Convite inicial de administrador enviado.");
    }
  }
}
