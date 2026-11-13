import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) {
    if (
      pathname === "/backoffice/login" ||
      pathname === "/backoffice/acesso-negado"
    ) {
      return NextResponse.next();
    }
    return pathname.startsWith("/api/")
      ? NextResponse.json(
          { error: "supabase_not_configured" },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        )
      : NextResponse.redirect(new URL("/backoffice/login?error=config", request.url));
  }

  let response = NextResponse.next({ request });
  let refreshedCookies: {
    name: string;
    value: string;
    options?: Parameters<typeof response.cookies.set>[2];
  }[] = [];
  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        refreshedCookies = cookiesToSet;
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isApi = pathname.startsWith("/api/backoffice/");
  const isLogin = pathname === "/backoffice/login";
  const isDenied = pathname === "/backoffice/acesso-negado";
  const isAdmin = user?.app_metadata.role === "admin";

  if (isLogin || isDenied) return response;
  if (isAdmin) return response;

  if (isApi) {
    const deniedResponse = NextResponse.json(
      { error: user ? "forbidden" : "unauthorized" },
      {
        status: user ? 403 : 401,
        headers: { "Cache-Control": "no-store" },
      },
    );
    refreshedCookies.forEach(({ name, value, options }) => {
      deniedResponse.cookies.set(name, value, options);
    });
    return deniedResponse;
  }

  if (user) {
    return NextResponse.redirect(new URL("/backoffice/acesso-negado", request.url));
  }

  const loginUrl = new URL("/backoffice/login", request.url);
  loginUrl.searchParams.set(
    "next",
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
  );
  const redirectResponse = NextResponse.redirect(loginUrl);
  refreshedCookies.forEach(({ name, value, options }) => {
    redirectResponse.cookies.set(name, value, options);
  });
  return redirectResponse;
}

export const config = {
  matcher: ["/backoffice/:path*", "/api/backoffice/:path*"],
};
