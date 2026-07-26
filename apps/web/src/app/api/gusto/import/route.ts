import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runGustoImport } from "@/lib/integrations";

const importRequestSchema = z.object({
  mode: z.enum(["csv", "api", "connector"]).default("csv")
});

export async function POST(request: NextRequest) {
  const body = request.headers.get("content-length") === "0" ? {} : await request.json().catch(() => ({}));
  const { mode } = importRequestSchema.parse(body);
  const summary = runGustoImport(mode);

  return NextResponse.json({
    ok: true,
    summary
  });
}
