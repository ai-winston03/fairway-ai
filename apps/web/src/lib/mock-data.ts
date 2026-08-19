import { calendarDateInZone, runConversationTurn } from "@/lib/conversation-engine";
import { demoAvailableTeeTimes } from "@/lib/tee-time-availability";

export type Message = {
  id: string;
  author: "member" | "bot";
  text: string;
  timestamp: string;
};

export type Metric = {
  label: string;
  value: string;
  trend: string;
};

export type ProductSignal = {
  name: string;
  category: "Merchandise" | "Food & Beverage" | "Cart";
  units: number;
  trend: number;
};

export type MemberRound = {
  member: string;
  membershipType: string;
  rounds: number;
  guestRounds: number;
  noGuestRounds: number;
  carts: number;
};

export const initialMessages: Message[] = [
  {
    id: "m1",
    author: "bot",
    timestamp: "9:02 AM",
    text:
      "I can hold a tee-time request, guests, carts, and a clubhouse order. What day would you like to play?"
  }
];

export const metrics: Metric[] = [
  { label: "Rounds today", value: "186", trend: "+14 vs last Tue" },
  { label: "Guest rounds", value: "42", trend: "23% of play" },
  { label: "Carts sold", value: "71", trend: "+9% weekly" },
  { label: "Labor cost", value: "$24.2k", trend: "Gusto-ready by department" },
  { label: "Current AR", value: "$28.4k", trend: "11 accounts past due" }
];

export const memberRounds: MemberRound[] = [
  {
    member: "Holland, Mark",
    membershipType: "Family Equity",
    rounds: 22,
    guestRounds: 9,
    noGuestRounds: 13,
    carts: 6
  },
  {
    member: "Kim, Sara",
    membershipType: "Corporate",
    rounds: 18,
    guestRounds: 2,
    noGuestRounds: 16,
    carts: 11
  },
  {
    member: "Bennett, Cole",
    membershipType: "Junior",
    rounds: 15,
    guestRounds: 0,
    noGuestRounds: 15,
    carts: 0
  },
  {
    member: "Anderson, Blake",
    membershipType: "Social Plus",
    rounds: 12,
    guestRounds: 7,
    noGuestRounds: 5,
    carts: 8
  }
];

export const productSignals: ProductSignal[] = [
  { name: "Titleist Pro V1", category: "Merchandise", units: 94, trend: 18 },
  { name: "Yeti Rambler", category: "Merchandise", units: 31, trend: 42 },
  { name: "Breakfast burrito", category: "Food & Beverage", units: 128, trend: 12 },
  { name: "Transfusion can", category: "Food & Beverage", units: 76, trend: 29 },
  { name: "18-hole cart", category: "Cart", units: 71, trend: 9 }
];

export const leadSources = [
  { source: "Online membership form", leads: 18, converted: 5 },
  { source: "Phone calls", leads: 31, converted: 7 },
  { source: "Guest follow-up SMS", leads: 14, converted: 4 }
];

export const recommendations = [
  {
    title: "Push Saturday guest conversion",
    text: "Guest rounds are high on weekend mornings. Send a follow-up offer to guests within 2 hours of play."
  },
  {
    title: "Stock up on emerging merch",
    text: "Yeti Rambler sales are lower volume but rising fastest. Move them near check-in and bundle with tournament signups."
  },
  {
    title: "Ask about carts in every SMS flow",
    text: "Cart attach rate is strongest when the bot asks before confirming the tee time."
  },
  {
    title: "Flag AR before booking extras",
    text: "Show staff a soft warning for members with overdue AR before approving account charges."
  }
];

export function createBotReply(message: string) {
  const now = new Date();
  return runConversationTurn({
    text: message,
    now,
    availableSlots: demoAvailableTeeTimes(calendarDateInZone(now, "America/Chicago")),
    phoneMatched: true
  }).reply;
}
