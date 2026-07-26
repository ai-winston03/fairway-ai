#!/usr/bin/env node

const baseUrl = process.env.FAIRWAY_AI_BASE_URL ?? "http://127.0.0.1:3042";
const secret = process.env.FOREUP_SYNC_SECRET;
if (!secret) throw new Error("FOREUP_SYNC_SECRET must be set.");

const [start, end = start] = process.argv.slice(2);
const response = await fetch(`${baseUrl}/api/foreup/reporting/sync`, {
  method: "POST",
  headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
  body: JSON.stringify({ start, end })
});
const result = await response.json();
if (!response.ok) throw new Error(result.error ?? `Reporting sync failed (${response.status}).`);
console.log(JSON.stringify(result, null, 2));
