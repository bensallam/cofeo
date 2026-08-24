import { describe, expect, it } from "vitest";
import {
  canTransition,
  getOrderTimeline,
  isTerminalStatus,
  mapWooCommerceStatusToCofeoStatus,
  resolveCofeoStatus,
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
