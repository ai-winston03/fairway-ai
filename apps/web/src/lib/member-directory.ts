import { getPublicMenuUrl } from "@/lib/menu";

export type DirectoryMember = {
  id: string;
  foreupCustomerId: string;
  name: string;
  membershipType: string;
  phone: string;
  email: string;
  status: "active" | "inactive" | "past_due";
  arBalanceCents: number;
  tags: string[];
  lastSyncedAt: string;
};

export type MemberPass = {
  id: string;
  name: string;
  remaining: number;
  expiresAt?: string;
};

export type ScheduledTeeTime = {
  id: string;
  courseName: string;
  startsAt: string;
  players: number;
  guests: number;
  carts: number;
  status: "confirmed" | "pending" | "checked_in";
};

export type MemberCustomerProfile = {
  memberId: string;
  accountBalanceCents: number;
  creditBookCents: number;
  passes: MemberPass[];
  scheduledTeeTimes: ScheduledTeeTime[];
  preferences: string[];
  staffNotes: string[];
  lastForeupSyncAt: string;
};

export type MemberChatMessage = {
  id: string;
  memberId: string;
  direction: "inbound" | "outbound";
  channel: "sms" | "email";
  body: string;
  sentAt: string;
  source: "member" | "staff" | "script" | "ai";
};

export type BotThreadControl = {
  memberId: string;
  status: "bot_active" | "staff_paused" | "staff_owned";
  activeWorkflow: string;
  lastBotActionAt: string;
  pausedBy?: string;
  pausedAt?: string;
};

export type ScheduledMessage = {
  id: string;
  name: string;
  memberId: string;
  memberName: string;
  cron: string;
  nextRunAt: string;
  channel: "sms" | "email";
  templateKey: string;
  aiAllowed: boolean;
  status: "active" | "paused" | "needs_review";
};

export type ForeupImportSummary = {
  source: "foreup";
  mode: "mock" | "live-ready";
  imported: number;
  updated: number;
  skipped: number;
  startedAt: string;
  completedAt: string;
};

export const directoryMembers: DirectoryMember[] = [
  {
    id: "mem_1001",
    foreupCustomerId: "3612897",
    name: "Mark Holland",
    membershipType: "Family Equity",
    phone: "+1 801-555-0184",
    email: "mark.holland@example.com",
    status: "active",
    arBalanceCents: 0,
    tags: ["Saturday regular", "Guests often"],
    lastSyncedAt: "2026-07-09T08:15:00.000Z"
  },
  {
    id: "mem_1002",
    foreupCustomerId: "3612911",
    name: "Sara Kim",
    membershipType: "Corporate",
    phone: "+1 801-555-0119",
    email: "sara.kim@example.com",
    status: "active",
    arBalanceCents: 8200,
    tags: ["Cart preference", "Morning tee times"],
    lastSyncedAt: "2026-07-09T08:15:00.000Z"
  },
  {
    id: "mem_1003",
    foreupCustomerId: "3613024",
    name: "Blake Anderson",
    membershipType: "Social Plus",
    phone: "+1 801-555-0142",
    email: "blake.anderson@example.com",
    status: "past_due",
    arBalanceCents: 64250,
    tags: ["Requires AR review"],
    lastSyncedAt: "2026-07-09T08:15:00.000Z"
  },
  {
    id: "mem_1004",
    foreupCustomerId: "3613058",
    name: "Cole Bennett",
    membershipType: "Junior",
    phone: "+1 801-555-0198",
    email: "cole.bennett@example.com",
    status: "active",
    arBalanceCents: 0,
    tags: ["Junior"],
    lastSyncedAt: "2026-07-09T08:15:00.000Z"
  }
];

export const memberCustomerProfiles: MemberCustomerProfile[] = [
  {
    memberId: "mem_1001",
    accountBalanceCents: 0,
    creditBookCents: 12500,
    passes: [
      { id: "pass_1", name: "Guest pass", remaining: 3, expiresAt: "2026-12-31T23:59:59.000Z" },
      { id: "pass_2", name: "Cart punch", remaining: 6 }
    ],
    scheduledTeeTimes: [
      {
        id: "tee_1001",
        courseName: "Yuba Golf Club",
        startsAt: "2026-07-11T08:36:00.000Z",
        players: 3,
        guests: 1,
        carts: 2,
        status: "confirmed"
      }
    ],
    preferences: ["Saturday mornings", "Usually needs carts", "Guest follow-up candidate"],
    staffNotes: ["Family equity member in good standing."],
    lastForeupSyncAt: "2026-07-09T08:15:00.000Z"
  },
  {
    memberId: "mem_1002",
    accountBalanceCents: 8200,
    creditBookCents: 0,
    passes: [{ id: "pass_3", name: "Corporate guest pass", remaining: 8, expiresAt: "2026-10-01T23:59:59.000Z" }],
    scheduledTeeTimes: [
      {
        id: "tee_1002",
        courseName: "Yuba Golf Club",
        startsAt: "2026-07-11T09:04:00.000Z",
        players: 4,
        guests: 0,
        carts: 2,
        status: "confirmed"
      }
    ],
    preferences: ["Morning tee times", "Cart preference", "Responsive to F&B preorder texts"],
    staffNotes: ["Corporate membership; route large group changes to pro shop."],
    lastForeupSyncAt: "2026-07-09T08:15:00.000Z"
  },
  {
    memberId: "mem_1003",
    accountBalanceCents: 64250,
    creditBookCents: 0,
    passes: [],
    scheduledTeeTimes: [
      {
        id: "tee_1003",
        courseName: "Yuba Golf Club",
        startsAt: "2026-07-11T10:12:00.000Z",
        players: 2,
        guests: 1,
        carts: 1,
        status: "pending"
      }
    ],
    preferences: ["Social play", "Confirm charges with staff"],
    staffNotes: ["Past-due AR. Hold account charges until reviewed."],
    lastForeupSyncAt: "2026-07-09T08:15:00.000Z"
  },
  {
    memberId: "mem_1004",
    accountBalanceCents: 0,
    creditBookCents: 4500,
    passes: [{ id: "pass_4", name: "Junior range pass", remaining: 12 }],
    scheduledTeeTimes: [
      {
        id: "tee_1004",
        courseName: "Yuba Golf Club",
        startsAt: "2026-07-12T07:48:00.000Z",
        players: 1,
        guests: 0,
        carts: 0,
        status: "confirmed"
      }
    ],
    preferences: ["Junior member", "No cart prompts"],
    staffNotes: ["Parent approval required for account charges."],
    lastForeupSyncAt: "2026-07-09T08:15:00.000Z"
  }
];

export const memberChatMessages: MemberChatMessage[] = [
  {
    id: "msg_1",
    memberId: "mem_1001",
    direction: "outbound",
    channel: "sms",
    body: "Your 8:36 tee time is confirmed for Saturday. Reply CARTS if you need carts reserved.",
    sentAt: "2026-07-09T08:20:00.000Z",
    source: "script"
  },
  {
    id: "msg_2",
    memberId: "mem_1001",
    direction: "inbound",
    channel: "sms",
    body: "Need 2 carts and one guest.",
    sentAt: "2026-07-09T08:24:00.000Z",
    source: "member"
  },
  {
    id: "msg_3",
    memberId: "mem_1002",
    direction: "outbound",
    channel: "sms",
    body: `Good morning Sara. Your group is on the sheet for 9:04. Menu for pre-round orders: ${getPublicMenuUrl()}`,
    sentAt: "2026-07-09T08:25:00.000Z",
    source: "script"
  },
  {
    id: "msg_4",
    memberId: "mem_1003",
    direction: "outbound",
    channel: "sms",
    body: "Please call the pro shop before adding account charges to today's booking.",
    sentAt: "2026-07-09T08:30:00.000Z",
    source: "script"
  }
];

export const botThreadControls: BotThreadControl[] = [
  {
    memberId: "mem_1001",
    status: "bot_active",
    activeWorkflow: "Tee time confirmation",
    lastBotActionAt: "2026-07-09T08:20:00.000Z"
  },
  {
    memberId: "mem_1002",
    status: "bot_active",
    activeWorkflow: "F&B pre-order prompt",
    lastBotActionAt: "2026-07-09T08:25:00.000Z"
  },
  {
    memberId: "mem_1003",
    status: "staff_owned",
    activeWorkflow: "AR review hold",
    lastBotActionAt: "2026-07-09T08:30:00.000Z",
    pausedBy: "Pro shop",
    pausedAt: "2026-07-09T08:31:00.000Z"
  },
  {
    memberId: "mem_1004",
    status: "bot_active",
    activeWorkflow: "Guest and cart attach",
    lastBotActionAt: "2026-07-09T08:15:00.000Z"
  }
];

export const scheduledMessages: ScheduledMessage[] = [
  {
    id: "sched_tee_confirm",
    name: "Tee time confirmation",
    memberId: "mem_1001",
    memberName: "Mark Holland",
    cron: "*/10 6-18 * * *",
    nextRunAt: "2026-07-09T10:20:00.000Z",
    channel: "sms",
    templateKey: "tee_time_confirmation",
    aiAllowed: false,
    status: "active"
  },
  {
    id: "sched_fnb_preorder",
    name: "F&B pre-order prompt",
    memberId: "mem_1002",
    memberName: "Sara Kim",
    cron: "*/15 6-16 * * *",
    nextRunAt: "2026-07-09T10:30:00.000Z",
    channel: "sms",
    templateKey: "pre_round_fnb",
    aiAllowed: false,
    status: "active"
  },
  {
    id: "sched_ar_hold",
    name: "AR review hold",
    memberId: "mem_1003",
    memberName: "Blake Anderson",
    cron: "0 7-17 * * *",
    nextRunAt: "2026-07-09T11:00:00.000Z",
    channel: "sms",
    templateKey: "ar_review",
    aiAllowed: false,
    status: "needs_review"
  }
];

export function getMemberConversation(memberId: string) {
  return memberChatMessages.filter((message) => message.memberId === memberId);
}

export function getBotThreadControl(memberId: string) {
  return (
    botThreadControls.find((control) => control.memberId === memberId) ?? {
      memberId,
      status: "bot_active",
      activeWorkflow: "Scheduled automation",
      lastBotActionAt: new Date().toISOString()
    }
  );
}

export function getMemberCustomerProfile(memberId: string) {
  return (
    memberCustomerProfiles.find((profile) => profile.memberId === memberId) ?? {
      memberId,
      accountBalanceCents: 0,
      creditBookCents: 0,
      passes: [],
      scheduledTeeTimes: [],
      preferences: [],
      staffNotes: [],
      lastForeupSyncAt: new Date().toISOString()
    }
  );
}

export function importForeupMembers(): ForeupImportSummary {
  const now = new Date().toISOString();

  return {
    source: "foreup",
    mode: process.env.FOREUP_API_TOKEN ? "live-ready" : "mock",
    imported: directoryMembers.length,
    updated: 0,
    skipped: 0,
    startedAt: now,
    completedAt: now
  };
}

export function renderScheduledTemplate(templateKey: string, member: DirectoryMember) {
  const templates: Record<string, string> = {
    tee_time_confirmation:
      "Hi {firstName}, your tee time is confirmed. Reply GUESTS to add guests or CARTS to reserve carts.",
    pre_round_fnb:
      "Hi {firstName}, want food or drinks ready before your round? Menu: {menuUrl} Reply with item names and quantities.",
    ar_review:
      "Hi {firstName}, please contact the pro shop before adding account charges to your booking."
  };

  const firstName = member.name.split(" ")[0] ?? member.name;
  return (templates[templateKey] ?? templates.tee_time_confirmation)
    .replace("{firstName}", firstName)
    .replace("{menuUrl}", getPublicMenuUrl());
}

export function getDueScheduledMessages(now = new Date()) {
  return scheduledMessages
    .filter((message) => message.status === "active" && new Date(message.nextRunAt) <= now)
    .map((message) => {
      const member = directoryMembers.find((item) => item.id === message.memberId);

      return {
        ...message,
        body: member ? renderScheduledTemplate(message.templateKey, member) : "",
        deterministic: true
      };
    });
}
