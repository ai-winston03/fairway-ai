import { describe, expect, it } from "vitest";
import {
  GOLF_NEEDS_ATTENTION,
  HELD_COPY_BADGE_CLASS,
  HELD_COPY_LABEL,
  golfBodyKind,
  heldRangeShowsKpis,
  holdGapKind,
  reportingHeroBadge
} from "./golf-held-ui";

describe("golf overview held copy", () => {
  it("forces the gold warning badge labeled Held copy even when coverage is complete", () => {
    const badge = reportingHeroBadge("golf");
    expect(badge.className).toBe(HELD_COPY_BADGE_CLASS);
    expect(badge.className).toContain("warning");
    expect(badge.label).toBe(HELD_COPY_LABEL);
    expect(badge.label).toBe("Held copy");
    expect(badge.label).not.toBe("Reporting data synced");
    expect(reportingHeroBadge("pro-shop").label).toBe(HELD_COPY_LABEL);
    expect(reportingHeroBadge("clubhouse").label).toBe(HELD_COPY_LABEL);
  });

  it("uses gold hold-gap for partial days and red missing only when days are gone", () => {
    expect(holdGapKind("complete")).toBe("none");
    expect(holdGapKind("partial")).toBe("partial");
    expect(holdGapKind("missing")).toBe("missing");
    expect(holdGapKind(undefined, true)).toBe("missing");
  });

  it("loads with no KPI body and keeps fetch failures in the golf shell", () => {
    expect(golfBodyKind({ error: null, loading: true, golf: null })).toBe("loading");
    expect(golfBodyKind({ error: "Reporting hold is unavailable.", loading: false, golf: null })).toBe("error");
    expect(GOLF_NEEDS_ATTENTION).toBe("Golf reporting needs attention");
  });

  it("shows the four KPIs for a held range with 0 rounds and hides invented totals when the range is missing", () => {
    expect(heldRangeShowsKpis("complete")).toBe(true);
    expect(heldRangeShowsKpis("partial")).toBe(true);
    expect(heldRangeShowsKpis("missing")).toBe(false);
    expect(golfBodyKind({ error: null, loading: false, golf: { coverage: { status: "complete" } } })).toBe("ready");
    expect(golfBodyKind({ error: null, loading: false, golf: { coverage: { status: "missing" } } })).toBe("missing");
  });
});
