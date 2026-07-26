#!/usr/bin/env node

const baseUrl = process.env.FAIRWAY_AI_BASE_URL ?? "http://127.0.0.1:3042";
const response = await fetch(`${baseUrl}/api/hr/metrics`);

if (!response.ok) {
  console.error(`Gusto HR metrics sync failed: ${response.status} ${response.statusText}`);
  process.exit(1);
}

const result = await response.json();
const snapshot = result.snapshot;

console.log(
  JSON.stringify(
    {
      ranAt: new Date().toISOString(),
      provider: result.provider,
      source: result.source,
      mode: snapshot.mode,
      status: result.status,
      payPeriod: snapshot.payPeriod,
      headcount: snapshot.summaryCards.find((card) => card.label === "Active headcount")?.value,
      grossPayroll: snapshot.summaryCards.find((card) => card.label === "Gross payroll")?.value,
      overtimeRate: snapshot.summaryCards.find((card) => card.label === "Overtime rate")?.value,
      departmentCount: snapshot.departmentMetrics.length,
      attentionItems: snapshot.attentionItems
    },
    null,
    2
  )
);
