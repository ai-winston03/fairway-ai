#!/usr/bin/env node

const baseUrl = process.env.FAIRWAY_AI_BASE_URL ?? "http://127.0.0.1:3042";
const mode = process.env.GUSTO_IMPORT_MODE ?? "csv";
const importUrl = `${baseUrl}/api/gusto/import`;

const response = await fetch(importUrl, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ mode })
});

if (!response.ok) {
  console.error(`Gusto import failed: ${response.status} ${response.statusText}`);
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
