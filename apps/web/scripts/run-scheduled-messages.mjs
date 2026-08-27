#!/usr/bin/env node

const baseUrl = process.env.FAIRWAY_AI_BASE_URL ?? "http://127.0.0.1:3042";
const schedulerUrl = `${baseUrl}/api/scheduler/run`;

const response = await fetch(schedulerUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ now: new Date().toISOString(), jobs: ["messages"] })
});

if (!response.ok) {
  console.error(`Scheduler failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const result = await response.json();
const held = result.held === true || result.sendingEnabled === false;

console.log(
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      mode: result.mode,
      aiUsed: result.aiUsed,
      sendingEnabled: result.sendingEnabled === true,
      held,
      sent: held ? 0 : (result.sent ?? 0),
      note: result.note,
      dueCount: result.dueCount,
      dueMessageIds: (result.dueMessages ?? []).map((message) => message.id)
    },
    null,
    2
  )
);
