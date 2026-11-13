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

  if (isLogin || isDenied) return response;
  if (user) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "backoffice_access_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    let accessResponse: Response;
    try {
      accessResponse = await fetch(`${url}/auth/v1/admin/users/${user.id}`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        cache: "no-store",
      });
    } catch (error) {
      console.error("[backoffice] current role lookup failed", error);
      return NextResponse.json(
        { error: "backoffice_access_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (accessResponse.status === 404) {
      // Deleted Auth users can still present an unexpired access token.
    } else if (!accessResponse.ok) {
      console.error("[backoffice] current role lookup failed", accessResponse.status);
      return NextResponse.json(
        { error: "backoffice_access_unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (accessResponse.status !== 404) {
      const accessData: unknown = await accessResponse.json();
      const currentUser = typeof accessData === "object" && accessData !== null && "user" in accessData
        ? accessData.user
        : accessData;
      const currentRole = typeof currentUser === "object" && currentUser !== null &&
        "app_metadata" in currentUser &&
        typeof currentUser.app_metadata === "object" && currentUser.app_metadata !== null &&
        "role" in currentUser.app_metadata
        ? currentUser.app_metadata.role
        : null;

      if (currentRole === "admin" || currentRole === "manager" || currentRole === "collaborator") {
        return response;
      }
    }
  }

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
