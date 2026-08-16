import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";
import { staffGuard } from "@/lib/staff-access";

const schema = z.object({
  workflowId: z.string()
});

export async function POST(request: NextRequest) {
  const access = await staffGuard(request, "workflow:view");
  if (access.error) return access.error;
  const { workflowId } = schema.parse(await request.json());
  const workflow = workflowLibrary.find((item) => item.id === workflowId);

  if (!workflow) {
    return NextResponse.json({ error: "Workflow not found" }, { status: 404 });
  }

  return NextResponse.json({
    workflow,
    safety: evaluateWorkflowSafety(workflow),
    executionMode: workflow.verification.requireOneTimeCodeForAccountCharge ? "scripted-with-verification" : "scripted"
  });
}
