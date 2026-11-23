import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "../../../../lib/backoffice-request";
import { buildExport, exportTypes, type ExportType } from "../../../../lib/finance-export";
import { isValidMonth } from "../../../../lib/finance";
import { PaymentLedgerNotMigratedError } from "../../../../lib/payments/orders";
import { requireAdmin } from "../../../../lib/supabase/require-admin";

const fileNames: Record<ExportType, string> = {
  entries: "entradas",
  withdrawals: "levantamentos",
  expenses: "despesas",
  reconciliation: "conciliacao",
};

export async function GET(request: NextRequest) {
  const authorization = await requireAdmin();
  if (!authorization.authorized) {
    return authorization.reason === "unauthenticated"
      ? errorResponse("unauthorized", 401)
      : errorResponse("forbidden", 403);
  }

  const type = request.nextUrl.searchParams.get("type");
  const month = request.nextUrl.searchParams.get("month");
  const exportType = exportTypes.find((item) => item === type);
  if (!exportType || !isValidMonth(month)) return errorResponse("invalid_export", 400);

  try {
    const csv = await buildExport(exportType, month);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kitadi-${fileNames[exportType]}-${month}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof PaymentLedgerNotMigratedError) {
      return errorResponse("ledger_not_migrated", 503);
    }
    console.error("[backoffice] export failed", error instanceof Error ? error.message : "unknown");
    return errorResponse("export_failed", 503);
  }
}
