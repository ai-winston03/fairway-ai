import { afterEach, beforeEach } from "vitest";

const original = process.env.FAIRWAY_SMS_SENDING_ENABLED;

beforeEach(() => {
  if (process.env.FAIRWAY_SMS_SENDING_ENABLED === undefined) {
    process.env.FAIRWAY_SMS_SENDING_ENABLED = "true";
  }
});

afterEach(() => {
  if (original === undefined) delete process.env.FAIRWAY_SMS_SENDING_ENABLED;
  else process.env.FAIRWAY_SMS_SENDING_ENABLED = original;
});
