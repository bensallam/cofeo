import { describe, expect, it } from "vitest";
import {
  canTransition,
  getOrderTimeline,
  getOrderTimelineWithHistory,
  isTerminalStatus,
  mapWooCommerceStatusToCofeoStatus,
  parseStatusHistory,
  parseStatusHistoryEvent,
  resolveCofeoStatus,
  type StatusHistoryEvent,
} from "./order-status";

describe("mapWooCommerceStatusToCofeoStatus", () => {
  it("maps pending to NEW", () => {
    expect(mapWooCommerceStatusToCofeoStatus("pending")).toBe("NEW");
  });

  it("maps on-hold (bank transfer awaiting verification) to NEW", () => {
    expect(mapWooCommerceStatusToCofeoStatus("on-hold")).toBe("NEW");
  });

  it("maps processing (COD, and post-verification) to CONFIRMED", () => {
    expect(mapWooCommerceStatusToCofeoStatus("processing")).toBe("CONFIRMED");
  });

  it("maps completed to DELIVERED", () => {
    expect(mapWooCommerceStatusToCofeoStatus("completed")).toBe("DELIVERED");
  });

  it("maps cancelled, failed, and refunded all to CANCELLED", () => {
    expect(mapWooCommerceStatusToCofeoStatus("cancelled")).toBe("CANCELLED");
    expect(mapWooCommerceStatusToCofeoStatus("failed")).toBe("CANCELLED");
    expect(mapWooCommerceStatusToCofeoStatus("refunded")).toBe("CANCELLED");
  });

  it("strips a wc- prefix if present", () => {
    expect(mapWooCommerceStatusToCofeoStatus("wc-processing")).toBe("CONFIRMED");
  });

  it("falls back to NEW for an unrecognized status rather than assuming progress", () => {
    expect(mapWooCommerceStatusToCofeoStatus("some-custom-plugin-status")).toBe("NEW");
  });

  it("maps the three Phase 4A custom WooCommerce statuses directly, no meta lookup needed", () => {
    expect(mapWooCommerceStatusToCofeoStatus("cofeo-preparing")).toBe("PREPARING");
    expect(mapWooCommerceStatusToCofeoStatus("cofeo-shipped")).toBe("SHIPPED");
    expect(mapWooCommerceStatusToCofeoStatus("cofeo-outfordel")).toBe("OUT_FOR_DELIVERY");
  });

  it("strips a wc- prefix from the Phase 4A custom statuses too", () => {
    expect(mapWooCommerceStatusToCofeoStatus("wc-cofeo-preparing")).toBe("PREPARING");
    expect(mapWooCommerceStatusToCofeoStatus("wc-cofeo-shipped")).toBe("SHIPPED");
    expect(mapWooCommerceStatusToCofeoStatus("wc-cofeo-outfordel")).toBe("OUT_FOR_DELIVERY");
  });
});

describe("resolveCofeoStatus (WC status + _cofeo_order_status meta refinement)", () => {
  it("uses the WC-derived status when no meta is present", () => {
    expect(resolveCofeoStatus("processing")).toBe("CONFIRMED");
    expect(resolveCofeoStatus("pending")).toBe("NEW");
    expect(resolveCofeoStatus("completed")).toBe("DELIVERED");
  });

  it("applies a PREPARING/SHIPPED/OUT_FOR_DELIVERY meta refinement while WC status is processing", () => {
    expect(resolveCofeoStatus("processing", "PREPARING")).toBe("PREPARING");
    expect(resolveCofeoStatus("processing", "SHIPPED")).toBe("SHIPPED");
    expect(resolveCofeoStatus("processing", "OUT_FOR_DELIVERY")).toBe("OUT_FOR_DELIVERY");
  });

  it("never lets a stale meta value override a terminal WC status", () => {
    // e.g. meta left over from before a cancellation/refund/completion
    expect(resolveCofeoStatus("cancelled", "SHIPPED")).toBe("CANCELLED");
    expect(resolveCofeoStatus("completed", "PREPARING")).toBe("DELIVERED");
    expect(resolveCofeoStatus("pending", "SHIPPED")).toBe("NEW");
  });

  it("Phase 4A: a real cofeo-* status is used directly, ignoring any leftover legacy meta", () => {
    // A migrated (or freshly created) order's real status is already
    // the source of truth — no meta lookup needed, and a stale meta
    // value (e.g. "SHIPPED" left over from before a later real-status
    // change) must never resurrect an earlier state.
    expect(resolveCofeoStatus("cofeo-preparing", "SHIPPED")).toBe("PREPARING");
    expect(resolveCofeoStatus("cofeo-outfordel", null)).toBe("OUT_FOR_DELIVERY");
  });

  it("ignores a meta value that isn't a legal refinement status", () => {
    expect(resolveCofeoStatus("processing", "DELIVERED")).toBe("CONFIRMED");
    expect(resolveCofeoStatus("processing", "not-a-real-status")).toBe("CONFIRMED");
  });
});

describe("canTransition — valid forward transitions", () => {
  it.each([
    ["NEW", "CONFIRMED"],
    ["CONFIRMED", "PREPARING"],
    ["PREPARING", "SHIPPED"],
    ["SHIPPED", "OUT_FOR_DELIVERY"],
    ["OUT_FOR_DELIVERY", "DELIVERED"],
  ] as const)("%s → %s is allowed", (from, to) => {
    expect(canTransition(from, to)).toBe(true);
  });

  it.each(["NEW", "CONFIRMED", "PREPARING", "SHIPPED", "OUT_FOR_DELIVERY"] as const)(
    "%s → CANCELLED is allowed (cancellation can happen at any pre-delivery point)",
    (from) => {
      expect(canTransition(from, "CANCELLED")).toBe(true);
    },
  );
});

describe("canTransition — invalid transitions are rejected", () => {
  it("rejects going backwards", () => {
    expect(canTransition("DELIVERED", "PREPARING")).toBe(false);
    expect(canTransition("SHIPPED", "CONFIRMED")).toBe(false);
    expect(canTransition("OUT_FOR_DELIVERY", "NEW")).toBe(false);
  });

  it("rejects skipping steps", () => {
    expect(canTransition("NEW", "SHIPPED")).toBe(false);
    expect(canTransition("CONFIRMED", "DELIVERED")).toBe(false);
  });

  it("rejects any transition out of a terminal status", () => {
    expect(canTransition("DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition("CANCELLED", "NEW")).toBe(false);
    expect(canTransition("CANCELLED", "CONFIRMED")).toBe(false);
  });

  it("rejects a no-op transition", () => {
    expect(canTransition("CONFIRMED", "CONFIRMED")).toBe(false);
  });
});

describe("isTerminalStatus", () => {
  it("DELIVERED and CANCELLED are terminal", () => {
    expect(isTerminalStatus("DELIVERED")).toBe(true);
    expect(isTerminalStatus("CANCELLED")).toBe(true);
  });

  it("every other status is not terminal", () => {
    expect(isTerminalStatus("NEW")).toBe(false);
    expect(isTerminalStatus("CONFIRMED")).toBe(false);
    expect(isTerminalStatus("PREPARING")).toBe(false);
    expect(isTerminalStatus("SHIPPED")).toBe(false);
    expect(isTerminalStatus("OUT_FOR_DELIVERY")).toBe(false);
  });
});

describe("getOrderTimeline", () => {
  it("marks everything up to and including the current step correctly for CONFIRMED", () => {
    const timeline = getOrderTimeline("CONFIRMED");
    expect(timeline.cancelled).toBe(false);
    if (timeline.cancelled) throw new Error("unreachable");
    expect(timeline.steps).toEqual([
      { key: "NEW", state: "done" },
      { key: "CONFIRMED", state: "active" },
      { key: "PREPARING", state: "upcoming" },
      { key: "SHIPPED", state: "upcoming" },
      { key: "OUT_FOR_DELIVERY", state: "upcoming" },
      { key: "DELIVERED", state: "upcoming" },
    ]);
  });

  it("marks every step done for DELIVERED", () => {
    const timeline = getOrderTimeline("DELIVERED");
    if (timeline.cancelled) throw new Error("unreachable");
    expect(timeline.steps.every((step) => step.state === "done")).toBe(true);
  });

  it("marks only the first step active for NEW", () => {
    const timeline = getOrderTimeline("NEW");
    if (timeline.cancelled) throw new Error("unreachable");
    expect(timeline.steps[0]).toEqual({ key: "NEW", state: "active" });
    expect(timeline.steps.slice(1).every((step) => step.state === "upcoming")).toBe(true);
  });

  it("returns a distinct cancelled shape instead of a partial ladder", () => {
    const timeline = getOrderTimeline("CANCELLED");
    expect(timeline).toEqual({ cancelled: true });
  });
});

describe("parseStatusHistory (Phase 4C — _cofeo_status_history)", () => {
  it("returns an empty array for missing/empty/non-string input", () => {
    expect(parseStatusHistory(undefined)).toEqual([]);
    expect(parseStatusHistory(null)).toEqual([]);
    expect(parseStatusHistory("")).toEqual([]);
    expect(parseStatusHistory(42)).toEqual([]);
  });

  it("returns an empty array for malformed JSON rather than throwing", () => {
    expect(parseStatusHistory("{not valid json")).toEqual([]);
  });

  it("returns an empty array when the parsed JSON isn't an array", () => {
    expect(parseStatusHistory(JSON.stringify({ status: "NEW" }))).toEqual([]);
  });

  it("parses a valid history array", () => {
    const raw = JSON.stringify([
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T11:00:00Z", source: "system" },
    ]);
    expect(parseStatusHistory(raw)).toEqual([
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T11:00:00Z", source: "system" },
    ]);
  });

  it("drops individual malformed entries instead of discarding the whole array", () => {
    const raw = JSON.stringify([
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
      { status: "NOT_A_REAL_STATUS", previousStatus: "CONFIRMED", timestamp: "2026-08-24T11:00:00Z" },
      { status: "PREPARING", timestamp: "" }, // empty timestamp — dropped
      { status: "PREPARING" }, // missing timestamp — dropped
      "not even an object",
    ]);
    const parsed = parseStatusHistory(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].status).toBe("CONFIRMED");
  });

  it("falls back previousStatus to null and source to system when absent or invalid", () => {
    const raw = JSON.stringify([{ status: "NEW", timestamp: "2026-08-24T10:00:00Z" }]);
    expect(parseStatusHistory(raw)).toEqual([
      { status: "NEW", previousStatus: null, timestamp: "2026-08-24T10:00:00Z", source: "system" },
    ]);
  });

  it("never lets an unexpected field (e.g. a leaked actor identity) through — only the four known-safe fields survive", () => {
    const raw = JSON.stringify([
      {
        status: "CONFIRMED",
        previousStatus: "NEW",
        timestamp: "2026-08-24T10:00:00Z",
        source: "admin",
        actorEmail: "admin@cofeo.ma",
        ip: "10.0.0.1",
        sessionToken: "leaked-secret",
      },
    ]);
    const parsed = parseStatusHistory(raw);
    expect(parsed).toHaveLength(1);
    expect(Object.keys(parsed[0]).sort()).toEqual(["previousStatus", "source", "status", "timestamp"]);
    expect(JSON.stringify(parsed)).not.toContain("admin@cofeo.ma");
    expect(JSON.stringify(parsed)).not.toContain("leaked-secret");
  });
});

describe("parseStatusHistoryEvent (Phase 4C hardened storage — one _cofeo_status_event_<id> record)", () => {
  it("returns null for missing/empty/non-string input", () => {
    expect(parseStatusHistoryEvent(undefined)).toBeNull();
    expect(parseStatusHistoryEvent(null)).toBeNull();
    expect(parseStatusHistoryEvent("")).toBeNull();
    expect(parseStatusHistoryEvent(42)).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    expect(parseStatusHistoryEvent("{not valid json")).toBeNull();
  });

  it("returns null when the parsed JSON is an array (that's the legacy shape, not this one)", () => {
    expect(parseStatusHistoryEvent(JSON.stringify([{ status: "NEW" }]))).toBeNull();
  });

  it("parses a single valid event", () => {
    const raw = JSON.stringify({
      status: "PREPARING",
      previousStatus: "CONFIRMED",
      timestamp: "2026-08-24T11:00:00Z",
      source: "admin",
    });
    expect(parseStatusHistoryEvent(raw)).toEqual({
      status: "PREPARING",
      previousStatus: "CONFIRMED",
      timestamp: "2026-08-24T11:00:00Z",
      source: "admin",
    });
  });

  it("returns null for an invalid status or a missing/empty timestamp", () => {
    expect(parseStatusHistoryEvent(JSON.stringify({ status: "NOT_REAL", timestamp: "2026-08-24T11:00:00Z" }))).toBeNull();
    expect(parseStatusHistoryEvent(JSON.stringify({ status: "NEW", timestamp: "" }))).toBeNull();
    expect(parseStatusHistoryEvent(JSON.stringify({ status: "NEW" }))).toBeNull();
  });

  it("falls back previousStatus to null and source to system when absent or invalid", () => {
    expect(parseStatusHistoryEvent(JSON.stringify({ status: "NEW", timestamp: "2026-08-24T10:00:00Z" }))).toEqual({
      status: "NEW",
      previousStatus: null,
      timestamp: "2026-08-24T10:00:00Z",
      source: "system",
    });
  });

  it("never lets an unexpected field (e.g. a leaked actor identity) through — only the four known-safe fields survive", () => {
    const raw = JSON.stringify({
      status: "CONFIRMED",
      previousStatus: "NEW",
      timestamp: "2026-08-24T10:00:00Z",
      source: "admin",
      actorEmail: "admin@cofeo.ma",
      ip: "10.0.0.1",
    });
    const parsed = parseStatusHistoryEvent(raw);
    expect(parsed).not.toBeNull();
    expect(Object.keys(parsed as object).sort()).toEqual(["previousStatus", "source", "status", "timestamp"]);
    expect(JSON.stringify(parsed)).not.toContain("admin@cofeo.ma");
  });
});

describe("getOrderTimelineWithHistory (Phase 4C)", () => {
  it("behaves exactly like getOrderTimeline when no history is given", () => {
    const withHistory = getOrderTimelineWithHistory("PREPARING");
    const base = getOrderTimeline("PREPARING");
    if (withHistory.cancelled || base.cancelled) throw new Error("unreachable");
    expect(withHistory.steps.map((s) => ({ key: s.key, state: s.state }))).toEqual(base.steps);
    expect(withHistory.steps.every((s) => s.timestamp === null)).toBe(true);
    expect(withHistory.corrections).toEqual([]);
  });

  it("attaches the recorded timestamp to each reached step, and null for steps never recorded", () => {
    const history: StatusHistoryEvent[] = [
      { status: "NEW", previousStatus: null, timestamp: "2026-08-24T09:00:00Z", source: "system" },
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:00Z", source: "system" },
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T11:00:00Z", source: "admin" },
    ];
    const timeline = getOrderTimelineWithHistory("PREPARING", history);
    if (timeline.cancelled) throw new Error("unreachable");

    const byKey = Object.fromEntries(timeline.steps.map((s) => [s.key, s.timestamp]));
    expect(byKey.NEW).toBe("2026-08-24T09:00:00Z");
    expect(byKey.CONFIRMED).toBe("2026-08-24T10:00:00Z");
    expect(byKey.PREPARING).toBe("2026-08-24T11:00:00Z");
    expect(byKey.SHIPPED).toBeNull();
    expect(byKey.OUT_FOR_DELIVERY).toBeNull();
    expect(byKey.DELIVERED).toBeNull();
    expect(timeline.corrections).toEqual([]);
  });

  it("does not fabricate a timestamp for the current step when no matching event was recorded", () => {
    const timeline = getOrderTimelineWithHistory("SHIPPED", []);
    if (timeline.cancelled) throw new Error("unreachable");
    expect(timeline.steps.find((s) => s.key === "SHIPPED")?.timestamp).toBeNull();
  });

  it("surfaces a reverse correction (DELIVERED -> PREPARING) without marking DELIVERED as active/done", () => {
    const history: StatusHistoryEvent[] = [
      { status: "NEW", previousStatus: null, timestamp: "2026-08-20T09:00:00Z", source: "system" },
      { status: "CONFIRMED", previousStatus: "NEW", timestamp: "2026-08-20T10:00:00Z", source: "system" },
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-20T11:00:00Z", source: "admin" },
      { status: "SHIPPED", previousStatus: "PREPARING", timestamp: "2026-08-20T12:00:00Z", source: "admin" },
      { status: "OUT_FOR_DELIVERY", previousStatus: "SHIPPED", timestamp: "2026-08-20T13:00:00Z", source: "admin" },
      { status: "DELIVERED", previousStatus: "OUT_FOR_DELIVERY", timestamp: "2026-08-20T14:00:00Z", source: "admin" },
      // The correction: an admin walks it back to PREPARING.
      { status: "PREPARING", previousStatus: "DELIVERED", timestamp: "2026-08-22T09:00:00Z", source: "admin" },
    ];
    const timeline = getOrderTimelineWithHistory("PREPARING", history);
    if (timeline.cancelled) throw new Error("unreachable");

    // Current status is PREPARING: the ladder must reflect that, not
    // the fact DELIVERED was ever reached.
    const preparing = timeline.steps.find((s) => s.key === "PREPARING");
    expect(preparing?.state).toBe("active");
    const delivered = timeline.steps.find((s) => s.key === "DELIVERED");
    expect(delivered?.state).toBe("upcoming");

    // But the correction itself is surfaced, with both timestamps.
    expect(timeline.corrections).toEqual([
      { from: "DELIVERED", to: "PREPARING", fromTimestamp: "2026-08-20T14:00:00Z", toTimestamp: "2026-08-22T09:00:00Z" },
    ]);

    // PREPARING's own step timestamp reflects the LATEST occurrence
    // (the correction), not the original 2026-08-20 pass through it.
    expect(preparing?.timestamp).toBe("2026-08-22T09:00:00Z");

    // DELIVERED has a real recorded timestamp (it really happened),
    // but since it's now "upcoming" again after the correction, that
    // timestamp must not appear on the step itself — only in
    // `corrections` above — or it would read as a done date sitting
    // next to an empty/not-yet-reached circle.
    expect(delivered?.timestamp).toBeNull();
  });

  it("a correction with no earlier recorded occurrence of its 'from' status gets a null fromTimestamp, never a fabricated one", () => {
    const history: StatusHistoryEvent[] = [
      // DELIVERED itself was never recorded (e.g. order predates Phase 4C) —
      // only the correction away from it was.
      { status: "PREPARING", previousStatus: "DELIVERED", timestamp: "2026-08-22T09:00:00Z", source: "admin" },
    ];
    const timeline = getOrderTimelineWithHistory("PREPARING", history);
    if (timeline.cancelled) throw new Error("unreachable");
    expect(timeline.corrections).toEqual([
      { from: "DELIVERED", to: "PREPARING", fromTimestamp: null, toTimestamp: "2026-08-22T09:00:00Z" },
    ]);
  });

  it("does not treat a forward transition as a correction", () => {
    const history: StatusHistoryEvent[] = [
      { status: "PREPARING", previousStatus: "CONFIRMED", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
    ];
    const timeline = getOrderTimelineWithHistory("PREPARING", history);
    if (timeline.cancelled) throw new Error("unreachable");
    expect(timeline.corrections).toEqual([]);
  });

  it("records a cancellation timestamp for the cancelled shape", () => {
    const history: StatusHistoryEvent[] = [
      { status: "NEW", previousStatus: null, timestamp: "2026-08-24T09:00:00Z", source: "system" },
      { status: "CANCELLED", previousStatus: "NEW", timestamp: "2026-08-24T10:00:00Z", source: "admin" },
    ];
    const timeline = getOrderTimelineWithHistory("CANCELLED", history);
    expect(timeline).toEqual({ cancelled: true, timestamp: "2026-08-24T10:00:00Z" });
  });

  it("cancelled shape has a null timestamp when no CANCELLED event was recorded", () => {
    const timeline = getOrderTimelineWithHistory("CANCELLED", []);
    expect(timeline).toEqual({ cancelled: true, timestamp: null });
  });
});
