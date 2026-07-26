export type WorkflowTrigger =
  | "booking.created"
  | "cron.member_import"
  | "cron.scheduled_message"
  | "teetime.minus_24h"
  | "teetime.minus_90m"
  | "teetime.checked_in"
  | "turn.window"
  | "sale.created";

export type VerificationRule = {
  requireMemberPhoneMatch: boolean;
  requireOneTimeCodeForAccountCharge: boolean;
  requireStaffApprovalAboveCents: number;
  blockWhenArAboveCents: number;
  alcoholRequiresStaffApproval: boolean;
};

export type WorkflowStep = {
  label: string;
  script: string;
  expectedIntent: string;
};

export type BotWorkflow = {
  id: string;
  name: string;
  status: "active" | "draft";
  trigger: WorkflowTrigger;
  audience: string;
  cronExpression?: string;
  aiAllowed: boolean;
  deterministicRules: string[];
  steps: WorkflowStep[];
  verification: VerificationRule;
  fallback: string;
};

export const preorderWorkflow: BotWorkflow = {
  id: "pre-round-fnb",
  name: "Pre-round F&B upsell",
  status: "active",
  trigger: "teetime.minus_90m",
  audience: "Confirmed tee times with 2+ players",
  cronExpression: "*/15 6-16 * * *",
  aiAllowed: false,
  deterministicRules: [
    "Only send between 6:00 AM and 4:00 PM local course time",
    "Skip if member has opted out of SMS marketing",
    "Skip if booking is cancelled or checked in",
    "Show no more than 5 available F&B items",
    "Require staff approval for alcohol or custom kitchen notes",
    "Hold order if AR balance exceeds threshold"
  ],
  steps: [
    {
      label: "Offer",
      expectedIntent: "accept_or_decline",
      script:
        "Your {time} tee time is confirmed for {playerCount}. Want drinks or food ready before the round?"
    },
    {
      label: "Category",
      expectedIntent: "choose_category",
      script: "Would you like drinks, breakfast, snacks, or something from the grill?"
    },
    {
      label: "Item selection",
      expectedIntent: "choose_items",
      script: "Here are today’s available options: {menuOptions}. Reply with item names and quantities."
    },
    {
      label: "Fulfillment",
      expectedIntent: "choose_pickup_time",
      script: "Should this be ready before your tee time or at the turn?"
    },
    {
      label: "Verification",
      expectedIntent: "verify_identity",
      script: "For account charges, I’ll send a one-time code to the member phone on file."
    },
    {
      label: "Confirmation",
      expectedIntent: "confirm_order",
      script: "Confirm {orderSummary} for {chargeSummary}? Reply YES to place it."
    }
  ],
  verification: {
    requireMemberPhoneMatch: true,
    requireOneTimeCodeForAccountCharge: true,
    requireStaffApprovalAboveCents: 15000,
    blockWhenArAboveCents: 50000,
    alcoholRequiresStaffApproval: true
  },
  fallback: "Route to pro shop or clubhouse staff when verification, menu availability, alcohol, or AR checks fail."
};

export const workflowLibrary: BotWorkflow[] = [
  preorderWorkflow,
  {
    id: "guest-cart-attach",
    name: "Guest and cart attach",
    status: "active",
    trigger: "booking.created",
    audience: "Bookings with guest count unknown or carts missing",
    cronExpression: "*/10 6-18 * * *",
    aiAllowed: false,
    deterministicRules: [
      "Ask once per booking",
      "Do not ask after check-in",
      "Escalate when player count exceeds SMS max"
    ],
    steps: [
      {
        label: "Guests",
        expectedIntent: "guest_count",
        script: "Will any guests be joining your tee time?"
      },
      {
        label: "Carts",
        expectedIntent: "cart_count",
        script: "How many carts should I reserve?"
      },
      {
        label: "Confirm",
        expectedIntent: "confirm_booking_update",
        script: "Confirm {guestCount} guests and {cartCount} carts for {time}?"
      }
    ],
    verification: {
      requireMemberPhoneMatch: true,
      requireOneTimeCodeForAccountCharge: false,
      requireStaffApprovalAboveCents: 0,
      blockWhenArAboveCents: 50000,
      alcoholRequiresStaffApproval: false
    },
    fallback: "Route to pro shop if the sender phone does not match the member on the booking."
  },
  {
    id: "foreup-member-import",
    name: "ForeUp member directory import",
    status: "active",
    trigger: "cron.member_import",
    audience: "ForeUp customers and membership records",
    cronExpression: "5 4 * * *",
    aiAllowed: false,
    deterministicRules: [
      "Pull member/customer records from ForeUp on a schedule",
      "Upsert by courseId plus foreupCustomerId",
      "Normalize phone numbers before matching chat threads",
      "Do not generate summaries during import",
      "Write rejected rows to ForeupImportRow for staff review"
    ],
    steps: [
      {
        label: "Fetch",
        expectedIntent: "script_fetch_foreup_members",
        script: "Run npm run foreup:import from cron or launchd."
      },
      {
        label: "Normalize",
        expectedIntent: "normalize_directory_record",
        script: "Normalize phone, email, membership type, AR balance, and SMS opt-in fields."
      },
      {
        label: "Upsert",
        expectedIntent: "upsert_member_directory",
        script: "Insert or update Member rows by foreUp customer id."
      }
    ],
    verification: {
      requireMemberPhoneMatch: false,
      requireOneTimeCodeForAccountCharge: false,
      requireStaffApprovalAboveCents: 0,
      blockWhenArAboveCents: 50000,
      alcoholRequiresStaffApproval: false
    },
    fallback: "Mark malformed ForeUp rows as skipped and leave them in the import review queue."
  },
  {
    id: "scripted-message-runner",
    name: "Scripted scheduled messages",
    status: "active",
    trigger: "cron.scheduled_message",
    audience: "Members with active scheduled message jobs",
    cronExpression: "*/5 6-18 * * *",
    aiAllowed: false,
    deterministicRules: [
      "Cron selects due ScheduledMessageJob rows",
      "Render message bodies from deterministic templates",
      "Skip opted-out members and closed accounts",
      "Place AR, alcohol, and custom-note cases into needs_review",
      "Do not call an LLM unless staff explicitly allows review assistance"
    ],
    steps: [
      {
        label: "Select due jobs",
        expectedIntent: "script_select_due_jobs",
        script: "Run npm run scheduler:run from cron or launchd."
      },
      {
        label: "Render template",
        expectedIntent: "render_deterministic_template",
        script: "Fill approved template variables from Member, Booking, and Workflow data."
      },
      {
        label: "Send or hold",
        expectedIntent: "send_or_review",
        script: "Send through SMS provider when rules pass; otherwise hold for staff."
      }
    ],
    verification: {
      requireMemberPhoneMatch: true,
      requireOneTimeCodeForAccountCharge: false,
      requireStaffApprovalAboveCents: 0,
      blockWhenArAboveCents: 50000,
      alcoholRequiresStaffApproval: true
    },
    fallback: "Create an OrderHold or review task instead of asking AI to improvise."
  }
];

export function evaluateWorkflowSafety(workflow: BotWorkflow) {
  const flags: string[] = [];

  if (!workflow.verification.requireMemberPhoneMatch) {
    flags.push("Member phone match is disabled.");
  }

  if (!workflow.verification.requireOneTimeCodeForAccountCharge && workflow.name.toLowerCase().includes("f&b")) {
    flags.push("Account charge OTP is disabled for F&B workflow.");
  }

  if (workflow.verification.blockWhenArAboveCents <= 0) {
    flags.push("AR blocking threshold is not configured.");
  }

  if (workflow.trigger.startsWith("cron.") && workflow.aiAllowed) {
    flags.push("Cron workflow should not allow AI by default.");
  }

  return {
    safeForAutopilot: flags.length === 0,
    flags
  };
}
