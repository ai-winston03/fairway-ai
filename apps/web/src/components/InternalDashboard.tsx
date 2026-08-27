import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, Cloud, Flag, MessageSquareText, ReceiptText, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClubSettingsPanel } from "@/components/ClubSettingsPanel";
import { MemberWorkspace } from "@/components/MemberWorkspace";
import { StaffHoldsQueue } from "@/components/StaffHoldsQueue";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";

export type OperationsArea = "golf" | "pro-shop" | "clubhouse" | "members" | "automations" | "platform";
