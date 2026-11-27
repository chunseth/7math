import { NextResponse, type NextRequest } from "next/server";
import { drawRush } from "../../../lib/rush/bank";
import { rushGrade, type RushRun } from "../../../lib/rush/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  const grade = rushGrade(request.nextUrl.searchParams.get("grade"));
  if (!grade) return NextResponse.json({ error: "Choose Grade 6, 7, or 8." }, { status: 400, headers });
  const { pack } = drawRush(grade);
  return NextResponse.json<RushRun>({ grade, pack, ranked: false }, { headers });
}
