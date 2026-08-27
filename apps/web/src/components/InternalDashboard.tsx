"use client";

import { CalendarDays, ChartNoAxesCombined, CircleGauge, ClipboardList, Cloud, Flag, MessageSquareText, ReceiptText, RefreshCw, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ClubSettingsPanel } from "@/components/ClubSettingsPanel";
import { MemberWorkspace } from "@/components/MemberWorkspace";
import { StaffHoldsQueue } from "@/components/StaffHoldsQueue";
import { evaluateWorkflowSafety, workflowLibrary } from "@/lib/workflows";
import { GOLF_NEEDS_ATTENTION, golfBodyKind, holdGapKind, reportingHeroBadge } from "@/lib/golf-held-ui";

export type OperationsArea = "golf" | "pro-shop" | "clubhouse" | "members" | "automations" | "platform";
type ReportRange = "mtd" | "last-month" | "this-quarter" | "last-quarter" | "ytd" | "custom";

type Segment = { rounds: number; bookings: number; carts: number; greenFeeRevenue: number };
type HoldCoverage = { status: "complete" | "partial" | "missing"; expectedDays: string[]; heldDays: string[]; missingDays: string[]; lastSyncedAt: string | null };
type GolfSnapshot = {
  today: { date: string; bookings: number; occupancy: number; playersCheckedIn: number; playerNoShows: number; potentialSlots: number; slotsAvailable: number; revenue: number };
  period: { start: string; end: string; label: string };
  coverage?: HoldCoverage;
  member: Segment;
  nonMember: Segment;
  unclassifiedRounds: number;
  priceClasses: string[];
  sourceBookings: number;
  daily?: Array<{ date: string; rounds: number; bookings: number; occupancy: number; potentialSlots: number; slotsAvailable: number; revenue: number; greenFeeRevenue: number }>;
};
type CommerceReport = {
  period: { start: string; end: string; label: string };
  coverage?: HoldCoverage;
  proShop: { transactions: number; unitsSold: number; revenue: number };
  clubhouse: { transactions: number; unitsSold: number; revenue: number };
  snackShack: { transactions: number; unitsSold: number; revenue: number };
  bar: { transactions: number; unitsSold: number; revenue: number };
  fnbUnassigned: { transactions: number; unitsSold: number; revenue: number };
  daily: Array<{ date: string; department: "pro_shop" | "snack_shack" | "bar" | "fnb_unassigned"; transactions: number; unitsSold: number; revenue: number }>;
};
