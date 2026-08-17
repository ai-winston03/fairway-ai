import { describe, expect, it } from "vitest";
import { reportPeriod } from "./report-period";

describe("reportPeriod", () => {
  it("keeps the encoded calendar YTD start on January 1", () => {
    const period = reportPeriod(new URLSearchParams("range=ytd"), "2026-08-16");
    expect(period).toEqual({ start: "2026-01-01", end: "2026-08-16", label: "Year to date" });
  });

  it("defaults to month to date", () => {
    expect(reportPeriod(new URLSearchParams(), "2026-08-16")).toEqual({
      start: "2026-08-01",
      end: "2026-08-16",
      label: "Month to date"
    });
  });
});
