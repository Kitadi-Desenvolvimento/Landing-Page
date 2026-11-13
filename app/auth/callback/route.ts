import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "../../lib/supabase/server";

function safeNextPath(value: string | null) {
  if (
    value?.startsWith("/backoffice/") &&
    !value.startsWith("//") &&
    !value.includes("\\")
  ) {
    return value;
  }
  return "/backoffice/definir-senha";
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/backoffice/login?error=invite", request.url));
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL("/backoffice/login?error=invite", request.url));
  }

  return NextResponse.redirect(
    new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url),
  );
}
