import { NextResponse } from "next/server";
import { drawRush } from "../../../lib/rush/bank";
import type { RushRun } from "../../../lib/rush/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const { pack } = drawRush();
  return NextResponse.json<RushRun>({ pack, ranked: false }, { headers: { "Cache-Control": "no-store" } });
}
