export const HELD_COPY_LABEL = "Held copy";
export const HELD_COPY_BADGE_CLASS = "connection-badge warning";
export const GOLF_NEEDS_ATTENTION = "Golf reporting needs attention";

export type HoldStatus = "complete" | "partial" | "missing";

export function holdGapKind(status?: HoldStatus | null, loadedEmpty = false): "none" | "partial" | "missing" {
  if (loadedEmpty || status === "missing") return "missing";
  if (status === "partial") return "partial";
  return "none";
}

export function golfBodyKind(input: {
  error: string | null;
  loading: boolean;
  golf: { coverage?: { status: HoldStatus } } | null;
}): "error" | "loading" | "missing" | "ready" {
  if (input.error) return "error";
  if (input.loading && !input.golf) return "loading";
  if (!input.golf || input.golf.coverage?.status === "missing") return "missing";
  return "ready";
}

/** Held days with zero rounds still surface the four real KPIs. Missing ranges do not. */
export function heldRangeShowsKpis(coverageStatus?: HoldStatus | null) {
  return coverageStatus === "complete" || coverageStatus === "partial";
}

export function reportingHeroBadge(area: "golf" | "pro-shop" | "clubhouse" | "members" | "automations" | "platform") {
  const reporting = area === "golf" || area === "pro-shop" || area === "clubhouse" || area === "platform";
  return { className: HELD_COPY_BADGE_CLASS, label: reporting ? HELD_COPY_LABEL : "Held directory" };
}
