import { BotBehaviorConfig, defaultBotConfig } from "@/lib/bot-config";
import {
  ConversationState,
  ConversationTurnResult,
  emptyConversationState,
  runConversationTurn
} from "@/lib/conversation-engine";
import { listHeldAvailableTeeTimes } from "@/lib/foreup-hold";
import {
  findMemberByPhone,
  InboxConversation,
  saveConversationBotState,
  setAutomationStatus
} from "@/lib/inbox-store";
import {
  planPreTurnSnackShackOutreach,
  PreTurnOutreachReason,
  PreTurnTeeTime
} from "@/lib/pre-turn-outreach";
import { demoAvailableTeeTimes, ProposedTeeTime } from "@/lib/tee-time-availability";

export type CustomerBotTurnInput = {
  conversation: InboxConversation;
  body: string;
  persist?: boolean;
  now?: Date;
  slots?: ProposedTeeTime[];
  useDemoSlots?: boolean;
};

export type CustomerBotTurn = {
  conversation: InboxConversation;
  reply: string | null;
  shouldReply: boolean;
  result: ConversationTurnResult;
};

export type PreTurnOutreachQueueInput = {
  conversation: InboxConversation;
  teeTime?: PreTurnTeeTime | null;
  member?: { optOutText?: boolean } | null;
  persist?: boolean;
  now?: Date;
  config?: BotBehaviorConfig;
};

export type PreTurnOutreachQueueResult = {
  conversation: InboxConversation;
  shouldSend: boolean;
  message: string | null;
  reason: PreTurnOutreachReason;
};

function pausedResult(state: ConversationState | undefined, phoneMatched: boolean, memberId?: string): ConversationTurnResult {
  return {
    state: state ?? emptyConversationState({ phoneMatched, memberId }),
    reply: "",
    shouldReply: false,
    booked: false,
    nextActions: ["staff_owned"]
  };
}

export async function handleCustomerMessage(input: CustomerBotTurnInput): Promise<CustomerBotTurn> {
  const persist = input.persist !== false;
  const member = await findMemberByPhone(input.conversation.phone);
  const phoneMatched = Boolean(member);
  const memberId = member?.id ?? input.conversation.memberId;
  const state = input.conversation.botState;

  if (input.conversation.automationStatus !== "bot_active") {
    return {
      conversation: input.conversation,
      reply: null,
      shouldReply: false,
      result: pausedResult(state, phoneMatched, memberId)
    };
  }

  if (member?.optOutText) {
    return {
      conversation: input.conversation,
      reply: null,
      shouldReply: false,
      result: pausedResult(state, phoneMatched, memberId)
    };
  }

  const courseId = process.env.FOREUP_COURSE_ID;
  const heldSlots = input.slots ?? (courseId ? await listHeldAvailableTeeTimes(courseId) : []);
  const availableSlots = heldSlots.length > 0
    ? heldSlots
    : input.useDemoSlots
      ? demoAvailableTeeTimes((input.now ?? new Date()).toISOString().slice(0, 10))
      : [];

  const result = runConversationTurn({
    text: input.body,
    state,
    now: input.now,
    config: defaultBotConfig,
    availableSlots,
    phoneMatched,
    memberId,
    automationStatus: input.conversation.automationStatus
  });

  let conversation: InboxConversation = {
    ...input.conversation,
    botState: result.state,
    memberId: memberId ?? input.conversation.memberId
  };
  if (persist) {
    if (result.state.phase === "staff_hold" && conversation.automationStatus === "bot_active") {
      conversation = await setAutomationStatus(conversation.id, "staff_paused") ?? conversation;
    }
    conversation = await saveConversationBotState(conversation.id, result.state) ?? conversation;
  }

  return {
    conversation,
    reply: result.shouldReply ? result.reply : null,
    shouldReply: result.shouldReply,
    result
  };
}

export async function queuePreTurnSnackShackPrompt(input: PreTurnOutreachQueueInput): Promise<PreTurnOutreachQueueResult> {
  const persist = input.persist !== false;
  const member = input.member !== undefined
    ? input.member
    : await findMemberByPhone(input.conversation.phone);
  const decision = planPreTurnSnackShackOutreach({
    teeTime: input.teeTime,
    conversation: input.conversation,
    member,
    now: input.now,
    config: input.config ?? defaultBotConfig
  });

  let conversation = input.conversation;
  if (decision.shouldSend) {
    conversation = {
      ...conversation,
      botState: decision.state,
      memberId: conversation.memberId
    };
    if (persist) {
      conversation = await saveConversationBotState(conversation.id, decision.state) ?? conversation;
    }
  }

  return {
    conversation,
    shouldSend: decision.shouldSend,
    message: decision.message,
    reason: decision.reason
  };
}
