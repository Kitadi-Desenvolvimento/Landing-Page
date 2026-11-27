import { NextResponse } from "next/server";
import { getMarketSnapshot } from "../../lib/market";

export async function GET() {
  const snapshot = await getMarketSnapshot();
  const hasData = snapshot.fx !== null || snapshot.quotes !== null;
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": hasData
        ? "public, s-maxage=60, stale-while-revalidate=300"
        : "no-store",
    },
  });
}
