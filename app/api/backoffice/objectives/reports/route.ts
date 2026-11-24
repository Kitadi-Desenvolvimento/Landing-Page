import { NextResponse, type NextRequest } from "next/server";
import {
  buildObjectiveReport,
  isObjectiveReportSchemaError,
  ObjectiveReportQueryError,
} from "../../../../lib/objective-reports";
import { reportDateRange, type ReportPeriod } from "../../../../lib/objective-periods";
import { loadObjectiveAccess } from "../../../../lib/objective-access";
import { requireBackofficeUser } from "../../../../lib/supabase/require-admin";

const reportPeriods = ["day", "week", "month"] as const;
const reportFormats = ["csv", "pdf"] as const;

export async function GET(request: NextRequest) {
  const authorization = await requireBackofficeUser();
  if (!authorization.authorized) {
    return NextResponse.json(
      { error: authorization.reason === "unauthenticated" ? "unauthorized" : "forbidden" },
      { status: authorization.reason === "unauthenticated" ? 401 :
        authorization.reason === "unavailable" ? 503 : 403 },
    );
  }

  const period = request.nextUrl.searchParams.get("period");
  const date = request.nextUrl.searchParams.get("date");
  const format = request.nextUrl.searchParams.get("format");
  if (
    !period || !reportPeriods.includes(period as (typeof reportPeriods)[number]) ||
    !date ||
    !format || !reportFormats.includes(format as (typeof reportFormats)[number])
  ) {
    return NextResponse.json({ error: "invalid_report" }, { status: 400 });
  }
  if (!reportDateRange(period as ReportPeriod, date)) {
    return NextResponse.json({ error: "invalid_report_date" }, { status: 400 });
  }

  try {
    const access = await loadObjectiveAccess(
      authorization.role,
      authorization.user.id,
      authorization.role === "manager" ? authorization.areaIds : null,
    );
    const report = await buildObjectiveReport(
      access,
      period as (typeof reportPeriods)[number],
      date,
    );
    const filename = `kitadi-relatorio-objectivos-${period}-${date}.${format}`;
    if (format === "csv") {
      return new NextResponse(report.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const pdf = await report.pdf();
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ObjectiveReportQueryError) {
      const missingSchema = isObjectiveReportSchemaError(error.code);
      if (!missingSchema) {
        console.error("[backoffice] objective report failed", error.code);
      }
      return NextResponse.json(
        { error: missingSchema ? "report_schema_missing" : "report_unavailable" },
        { status: 503 },
      );
    }
    console.error("[backoffice] objective report failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.json({ error: "report_unavailable" }, { status: 503 });
  }
}
