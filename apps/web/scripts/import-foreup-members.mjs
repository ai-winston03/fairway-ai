#!/usr/bin/env node

const baseUrl = process.env.FAIRWAY_AI_BASE_URL ?? "http://127.0.0.1:3042";
const importUrl = `${baseUrl}/api/foreup/members/import`;

const response = await fetch(importUrl, {
  method: "POST",
  headers: { "content-type": "application/json" }
});

if (!response.ok) {
  console.error(`ForeUp import failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const result = await response.json();

console.log(
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      ...result.summary
    },
    null,
    2
  )
);
