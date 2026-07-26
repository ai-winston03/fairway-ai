import { demoAccessProfiles, StaffRole, TeamAccessProfile } from "@/lib/authz";

export type TeamRole = StaffRole;
export type TeamUser = TeamAccessProfile;

export type BotBehaviorConfig = {
  tone: "concise" | "friendly" | "premium";
  requireApprovalForCharges: boolean;
  askAboutGuests: boolean;
  askAboutCarts: boolean;
  askAboutFood: boolean;
  maxPlayersBySms: number;
  staffHandoffKeywords: string[];
  arWarningThresholdCents: number;
};

export const demoUsers: TeamUser[] = demoAccessProfiles;

export const defaultBotConfig: BotBehaviorConfig = {
  tone: "premium",
  requireApprovalForCharges: true,
  askAboutGuests: true,
  askAboutCarts: true,
  askAboutFood: true,
  maxPlayersBySms: 4,
  staffHandoffKeywords: ["cancel", "refund", "complaint", "manager", "charge dispute"],
  arWarningThresholdCents: 50000
};
