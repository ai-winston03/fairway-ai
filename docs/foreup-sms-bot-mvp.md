# FairwayAI foreUP SMS Bot MVP

## Customer-facing flow

1. Receive SMS through Twilio or another SMS provider.
2. Identify the member by phone number, then confirm identity for sensitive actions.
3. Ask for requested day/time, player count, guest count, carts, rentals, and food/beverage.
4. Use foreUP tee time slots to find availability:
   `GET /courses/{courseId}/teesheets/{teesheetId}/teetimes`
5. Create the tee time:
   `POST /courses/{courseId}/teesheets/{teeSheetId}/bookings`
6. Add players or update booked players as needed:
   `PUT /courses/{courseId}/teesheets/{teeSheetId}/bookings/{bookingId}/bookedPlayers/{bookedPlayerId}`
7. If sale/cart flow is needed, use:
   - `POST /courses/{courseId}/carts`
   - `POST /courses/{courseId}/carts/{cartId}/customers`
   - `POST /courses/{courseId}/carts/{cartId}/items`
   - `POST /courses/{courseId}/carts/{cartId}/payments`
   - `PUT /courses/{courseId}/carts/{cartId}`
8. If member account charge is the right flow, validate:
   `POST /courses/{courseId}/customers/{customerId}/accountTransactions`
9. Text the confirmation, cancellation policy, and receipt link.

## Internal dashboard data sources

- Member directory: foreUP customer/member records imported on a schedule and upserted by
  `courseId + foreupCustomerId`
- Individual chats: normalized phone numbers mapped to a `ChatConversation` per member/channel
- Menu link: foreUP POS/menu items exposed through a member-facing `/menu` page
- Rounds by member: bookings with `include=players,sales,sales.items`
- Guest/no-guest split: booked players and guest flags
- Carts sold: sales items in category `Carts`
- Merchandise movement: sales items by SKU/category over trailing windows
- Food and beverage: sales items by F&B department/category
- New members and membership type sold: customer records plus membership products
- Leads: online form submissions, phone call logs, and converted customer records
- AR: account invoices and customer account balances
- HR/payroll: Gusto labor hours, overtime, gross pay, department, and headcount imported into
  department-scoped KPI groups
- Recommendations: rule-based operating prompts first; AI summaries only after staff opts into review

## ForeUp member import and chat directory

Member import should be boring, repeatable, and scriptable:

1. Cron or launchd runs `npm run foreup:import`.
2. The script calls `/api/foreup/members/import`.
3. The adapter fetches foreUP customer/member records.
4. Records are normalized into `Member` rows:
   - foreUP customer ID
   - name
   - phone
   - email
   - membership type/status
   - SMS opt-in state
   - AR balance
   - sync timestamp
5. Bad rows are written to `ForeupImportRow` with an error and shown to staff for review.
6. The directory UI reads `Member` rows and lets staff switch conversations by member.

The chat view should never infer identity from AI. Match inbound messages by normalized phone number
first, then attach them to the member's `ChatConversation`. If multiple members share a phone,
hold the thread for staff assignment.

Automation ownership should also be explicit. A member conversation has an `automationStatus`
such as `bot_active`, `staff_paused`, or `staff_owned`. When the bot is active, the staff composer
must be disabled and the UI must show which workflow is handling the thread. Staff must pause the
bot before sending a manual reply. This prevents the bot and employee from interleaving messages
and confusing the customer. Resuming the bot should be a deliberate action after the staff handoff
is complete.

## Passwordless team access and bot behavior management

The MVP uses a mock magic-link flow so staff can enter internal mode without passwords. Production
should use email SSO/magic links only: no shared passwords and no generic staff account.

Production should use:

- Clerk or Auth.js for signed, expiring email magic links
- Role-based permissions for general employee, department manager, owner, and admin
- General employee access limited to member lookup and customer messaging
- Department manager access scoped to the KPI groups shared with their department
- Owner/admin access to all KPI groups, workflow settings, user management, and audit views
- Audit logs for bot setting changes, manual booking changes, refunds, and account charges
- SSO if the course wants foreUP employee identity mapped into FairwayAI

KPI sharing should be explicit. Store KPI groups such as pro shop, F&B, membership, and finance,
then grant each staff user access by course and group. A pro shop employee should not see finance
AR dashboards unless an owner/admin shares that group.

Bot behavior should be managed by internal admin users, not by code edits. The current control
surface should eventually persist these settings:

- Bot voice/tone
- Whether to always ask about guests
- Whether to always ask about carts
- Whether to ask for F&B preorders
- Maximum players allowed through SMS without staff review
- Staff approval requirement before account charges
- AR warning threshold
- Handoff keywords for staff escalation

Sensitive actions should not be fully autonomous until foreUP payment/member-account behavior is
verified. Use staff approval for member charges, refunds, complaints, and AR-risk accounts.

## Deterministic workflow engine

The bot should run from workflow definitions, cron jobs, and scripts rather than open-ended agent
decisions.

Workflow shape:

1. Trigger: `booking.created`, `teetime.minus_24h`, `teetime.minus_90m`, `teetime.checked_in`,
   `turn.window`, `sale.created`
2. Audience: booking/player/customer criteria
3. Deterministic rules: time windows, opt-out checks, max items, AR thresholds, menu availability
4. Scripted steps: exact prompts with variables such as `{time}`, `{playerCount}`, `{menuOptions}`
5. Expected intent: the narrow response type the bot is allowed to parse
6. Verification: identity, OTP, staff approval, AR and alcohol controls
7. Fallback: staff route when the script cannot safely continue

Cron/script entry points:

- `npm run foreup:import` for member directory sync
- `npm run scheduler:run` for due scheduled messages
- `npm run gusto:import` for Gusto CSV/API/connector import runs
- `npm run gusto:sync` for Gusto payroll/labor KPI refresh
- `GET /api/foreup/menu` for the ForeUp-backed public menu payload
- `GET /api/gusto/labor` for the Gusto labor reporting payload
- `POST /api/gusto/import` for cron-triggered import execution summaries
- `/menu` for the member-safe SMS menu link

The scheduler should select due `ScheduledMessageJob` rows, render approved templates, enforce
opt-out/AR/alcohol/staff-review rules, and only then send. AI is disabled by default. If a message
cannot be handled deterministically, set the job or related hold to `needs_review` rather than
asking a model to improvise.

Menu messages should send a link instead of trying to fit the full menu into SMS:

- Public member URL: `/menu`
- API source: `/api/foreup/menu`
- SMS template variable: `{menuUrl}`
- Member replies with item names and quantities
- Staff review still applies for alcohol, custom notes, unavailable items, high AR, or unclear replies

The initial workflow is "Pre-round F&B upsell":

- Trigger: 90 minutes before tee time
- Audience: confirmed tee times with 2+ players
- Offer: drinks/food before the round
- Menu source: foreUP Items filtered to available F&B categories
- Charge path: account charge only after phone match and one-time code
- Staff hold: alcohol, custom kitchen notes, large orders, high AR, failed verification

## Impersonation and dine-and-dash prevention

Minimum controls:

- Match inbound SMS phone number to the foreUP customer/member phone before showing account actions
- Send a one-time code to the phone on file before any member-account charge
- Require explicit `YES` confirmation with itemized order and charge amount
- Block or hold charges when AR balance is over threshold
- Require staff approval for alcohol, large orders, custom kitchen notes, refunds, complaints, or disputes
- Never allow a guest phone to charge a member account unless the member approves
- Keep an audit trail for workflow ID, message transcript, member ID, device/channel, order, and approver
- Send receipt/confirmation immediately after placing an order or account transaction

Production should store verification challenges as hashed codes with expiry, not plaintext codes.
Failed verification should not reveal which member fields matched.

## Questions to resolve with foreUP

- Which payment route is approved for member account charges from SMS?
- Can API-created bookings require card/member verification before confirmation?
- Which booking payload fields are required for guests and member pricing?
- Are F&B/menu items represented as normal items, modifiers, or a separate POS category?
- Are account invoices sufficient for current AR, or is there a separate AR endpoint?
- What are the API rate limits and webhook retry semantics?

## Integration stance

The app should keep foreUP behind an adapter. The UI, bot state machine, dashboard, and database schema can be built against mocks now. When credentials arrive, replace mock adapter calls with live calls and run contract tests against a sandbox course.

## Deployment and worker setup

Use Vercel for the Next.js app and Supabase Postgres for shared state. Use a small VPS, launchd, or
cron host for scripts that need predictable background execution:

- `npm run foreup:import`: imports ForeUp customers/members and writes skipped rows for review.
- `npm run scheduler:run`: renders due deterministic scheduled messages and sends only when rules pass.
- `npm run gusto:sync`: imports Gusto labor reports and maps departments to KPI groups.
- `npm run gusto:import`: records the selected Gusto import mode and returns an auditable, no-AI summary.

The app should share `DATABASE_URL`, `FOREUP_*`, `GUSTO_*`, and SMS provider credentials between
Vercel and the worker. Worker runs should write `WorkerRun` records with `aiUsed=false` unless a
staff-approved review path explicitly invokes AI. Production sends should remain disabled until the
SMS provider, opt-out rules, staff pause gate, and account-charge verification are tested end to end.
