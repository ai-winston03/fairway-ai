import { NextRequest, NextResponse } from "next/server";
import { getMemberConversation } from "@/lib/member-directory";

type RouteContext = {
  params: Promise<{
    memberId: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  const { memberId } = await context.params;

  return NextResponse.json({
    messages: getMemberConversation(memberId)
  });
}
