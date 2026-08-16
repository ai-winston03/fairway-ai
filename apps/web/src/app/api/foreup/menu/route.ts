import { NextRequest, NextResponse } from "next/server";
import { getForeupMenu } from "@/lib/menu";
import { staffGuard } from "@/lib/staff-access";

export async function GET(request: NextRequest) {
  const access = await staffGuard(request);
  if (access.error) return access.error;
  const courseId = request.nextUrl.searchParams.get("courseId") ?? "demo-course";
  const menu = await getForeupMenu(courseId);

  return NextResponse.json(menu);
}
