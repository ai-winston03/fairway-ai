# Club settings and staff holds

Use this page when you need the dark Fairway customer bot to read club settings, refuse non-members, and queue staff work from Firebase. This is not a live booking or SMS launch.

## What you can do now

1. Store club settings in Firestore at `clubSettings/{courseId}`.
2. Edit the pro shop phone, restaurant hours, FAQ, and members-only message from **Platform** > **Club settings**.
3. Review queued booking and snack-shack work from **Members** > **Holds**.
4. Offer held tee times from `foreupHold/teetimes-{courseId}` after the App Hosting `foreup-hold` job writes them.

The bot does not send customer SMS from this queue. `createBooking` still throws. Interactive paths do not pull live ForeUp.

## Club settings

Open **Platform** > **Club settings**, then save the fields the bot reads on every turn.

- **Pro shop phone.** Unanswered questions refer callers here.
- **Restaurant hours.** Food and pre-order offers run only when the restaurant is open in `America/Chicago` unless you change the timezone.
- **FAQ.** The bot answers a matching question. If nothing matches, it tells the member to call the pro shop.
- **Members-only message.** Default copy is `this is a members only Yuba Golf Club bot`.

A phone that is not in the held Firebase member directory receives that members-only message once. After that, the bot does not reply again. The person can call the pro shop.

## Staff holds

When the conversation engine emits `hold_request` or `hold_snack_shack`, Fairway writes a `staffHolds` document with status `queued`. The pre-turn snack-shack scheduler also writes a queued snack-shack prompt when a held tee time is inside the 180-minute window.

Open **Members** > **Holds** to review those drafts. The queue never calls `sendSms` and never marks a hold sent. If Twilio is absent, the status stays `queued`.

## Held tee times

The App Hosting scheduler writes availability. POST `/api/scheduler/run` with `{"jobs":["foreup-hold"]}` and the `FOREUP_SYNC_SECRET` bearer token. That job reads official ForeUp `GET teetimes` rows and stores them at `foreupHold/teetimes-{courseId}`.

Do not run `npm run foreup:hold` from a developer Mac. Schedule the POST against the hosted Fairway URL instead.

The production bot reads availability only through `readHeldAvailability` and `listHeldAvailableTeeTimes`. It offers slots with `spotsOpen` and ignores demo slots.

Cart and snack-shack sales stay in the staff hold. Fairway does not POST a live ForeUp booking, cart, payment, or account transaction.

## Named blockers

- Live ForeUp booking creation remains disabled.
- Customer SMS is not enabled from the staff-hold queue.
- This page does not claim a live public launch.
- Cloud Scheduler must call the hosted `/api/scheduler/run` job. This workspace does not run `foreup:hold`.
