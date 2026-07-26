export type BotMode = "customer" | "internal";

export type TeeTimeBookingIntent = {
  memberId?: string;
  requestedDate?: string;
  requestedWindow?: string;
  playerCount?: number;
  guestCount?: number;
  cartCount?: number;
  foodAndBeverageOrder?: string;
};

export type ForeupWebhookEvent =
  | "sale.created"
  | "teetime.created"
  | "teetime.updated"
  | "teetime.deleted"
  | "customer.updated"
  | "seasonalTimeframe.updated"
  | "seasonalTimeframe.created";
