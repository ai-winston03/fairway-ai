import { NextRequest, NextResponse } from "next/server";
import { getForeupMenu } from "@/lib/menu";

export async function GET(request: NextRequest) {
  const courseId = request.nextUrl.searchParams.get("courseId") ?? "demo-course";
  const menu = await getForeupMenu(courseId);

  return NextResponse.json(menu);
}
